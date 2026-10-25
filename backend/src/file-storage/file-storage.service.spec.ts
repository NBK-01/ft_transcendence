import { HttpStatus, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Repository } from 'typeorm';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { DomainException } from '../common/exceptions/base/error-types';
import { CryptoService } from '../common/services/crypto.service';
import { User } from '../users/user.entity';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import {
  FileStorageErrorCodes,
  FileTooLargeException,
  FileUploadFailedException,
  InvalidFileTypeException,
} from './exceptions/file-storage-exceptions';
import { FileStorageService } from './file-storage.service';
import {
  StorageProvider,
  UploadOptions,
} from './interfaces/storage-provider.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';

/**
 * Where uploaded files go, and what the rest of the app keeps of them.
 *
 * Part 1 runs the real FileStorageService over an in-memory bucket: which
 * files are accepted, the key each one is stored under, and that only the
 * key is kept (every read signs a fresh, expiring URL).
 *
 * Part 2 runs the real S3StorageProvider with S3Client.send stubbed, so the
 * exact commands sent to S3/MinIO are checked without a network. URL signing
 * is real: presigning is pure computation and needs no server.
 *
 * Part 3 is the avatar route end to end (controller → storage → users).
 */

const MB = 1024 * 1024;
const bytes = (size: number) => Buffer.alloc(size, 1);

class InMemoryBucket implements StorageProvider {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  private signed = 0;
  failUploads = false;

  uploadFile(body: Buffer, key: string, { contentType }: UploadOptions) {
    if (this.failUploads)
      return Promise.reject(new FileUploadFailedException());
    this.objects.set(key, { body, contentType });
    return Promise.resolve({ key, bucket: 'test-bucket' });
  }
  deleteFile(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
  getSignedUrl(key: string) {
    return Promise.resolve(`https://bucket.test/${key}?sig=${++this.signed}`);
  }
  fileExists(key: string) {
    return Promise.resolve(this.objects.has(key));
  }
}

function storage() {
  const bucket = new InMemoryBucket();
  return { bucket, files: new FileStorageService(bucket) };
}

async function expectStorageError(
  run: () => unknown,
  type: new (...args: never[]) => DomainException,
  status: HttpStatus,
  code: FileStorageErrorCodes,
): Promise<void> {
  const error = await Promise.resolve()
    .then(run)
    .then(
      () => {
        throw new Error('expected the file to be refused');
      },
      (reason: unknown) => reason,
    );
  expect(error).toBeInstanceOf(type);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

const expectInvalidType = (run: () => unknown) =>
  expectStorageError(
    run,
    InvalidFileTypeException,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.InvalidFileType,
  );
const expectTooLarge = (run: () => unknown) =>
  expectStorageError(
    run,
    FileTooLargeException,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.FileTooLarge,
  );

describe('avatars', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'a %s is stored under avatars/<userId>-…<ext> with its content type',
    async (contentType) => {
      const { bucket, files } = storage();

      const { key, url } = await files.uploadAvatar(
        bytes(100),
        'user-1',
        'me.photo.png',
        contentType,
      );

      expect(key).toMatch(/^avatars\/user-1-\d+\.png$/);
      expect(bucket.objects.get(key)).toEqual({
        body: bytes(100),
        contentType,
      });
      expect(url).toContain(key);
    },
  );

  it.each(['image/gif', 'application/pdf', 'image/svg+xml', 'text/html'])(
    'a %s is refused (400, 9001) and nothing is stored',
    async (contentType) => {
      const { bucket, files } = storage();

      await expectInvalidType(() =>
        files.uploadAvatar(bytes(100), 'user-1', 'x', contentType),
      );
      expect(bucket.objects.size).toBe(0);
    },
  );

  it('exactly 2 MB is accepted, one byte more is refused (400, 9002)', async () => {
    const { bucket, files } = storage();

    await files.uploadAvatar(bytes(2 * MB), 'user-1', 'a.png', 'image/png');
    await expectTooLarge(() =>
      files.uploadAvatar(bytes(2 * MB + 1), 'user-1', 'b.png', 'image/png'),
    );
    expect(bucket.objects.size).toBe(1);
  });
});

describe('shipment files', () => {
  it('are stored under shipments/<trackingId>/, keep the extension, and never collide', async () => {
    const { bucket, files } = storage();

    const first = await files.uploadShipmentFile(
      bytes(10),
      'TRK-1',
      'invoice.pdf',
      'application/pdf',
      'document',
    );
    const second = await files.uploadShipmentFile(
      bytes(10),
      'TRK-1',
      'invoice.pdf',
      'application/pdf',
      'document',
    );

    expect(first.key).toMatch(/^shipments\/TRK-1\/\d+-[0-9a-f-]{36}\.pdf$/);
    expect(second.key).not.toBe(first.key);
    expect(bucket.objects.get(first.key)?.contentType).toBe('application/pdf');
  });

  it('upload returns only the key, never a URL to persist', async () => {
    const { files } = storage();

    const result = await files.uploadShipmentFile(
      bytes(10),
      'TRK-1',
      'a.png',
      'image/png',
      'image',
    );

    expect(Object.keys(result)).toEqual(['key']);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
    'category "image" accepts %s',
    (contentType) => {
      const { files } = storage();

      expect(() =>
        files.validateShipmentFile(bytes(10), contentType, 'image'),
      ).not.toThrow();
    },
  );

  it('category "image" refuses a PDF (400, 9001)', async () => {
    const { files } = storage();

    await expectInvalidType(() =>
      files.validateShipmentFile(bytes(10), 'application/pdf', 'image'),
    );
  });

  it('category "document" accepts images and PDFs, nothing else', async () => {
    const { files } = storage();

    expect(() =>
      files.validateShipmentFile(bytes(10), 'application/pdf', 'document'),
    ).not.toThrow();
    expect(() =>
      files.validateShipmentFile(bytes(10), 'image/png', 'document'),
    ).not.toThrow();
    await expectInvalidType(() =>
      files.validateShipmentFile(bytes(10), 'application/zip', 'document'),
    );
  });

  it('exactly 10 MB is accepted, one byte more is refused (400, 9002) before anything is stored', async () => {
    const { bucket, files } = storage();

    expect(() =>
      files.validateShipmentFile(bytes(10 * MB), 'image/png', 'image'),
    ).not.toThrow();
    await expectTooLarge(() =>
      files.uploadShipmentFile(
        bytes(10 * MB + 1),
        'TRK-1',
        'big.png',
        'image/png',
        'image',
      ),
    );
    expect(bucket.objects.size).toBe(0);
  });
});

describe('reading files back', () => {
  it('every read signs a fresh URL for the stored key', async () => {
    const { files } = storage();

    const first = await files.getFileUrl('shipments/TRK-1/a.png');
    const second = await files.getFileUrl('shipments/TRK-1/a.png');

    expect(first).toContain('shipments/TRK-1/a.png');
    expect(second).not.toBe(first);
  });

  it('deleteFile removes the object', async () => {
    const { bucket, files } = storage();
    const { key } = await files.uploadAvatar(
      bytes(10),
      'user-1',
      'a.png',
      'image/png',
    );

    await files.deleteFile(key);

    expect(bucket.objects.has(key)).toBe(false);
  });
});

describe('S3StorageProvider (the real S3/MinIO adapter)', () => {
  const config = {
    endpoint: 'http://localhost:9000',
    forcePathStyle: true,
    region: 'us-east-1',
    bucket: 'shipping-dev',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  };

  function s3(send: (command: unknown) => Promise<unknown>) {
    const provider = new S3StorageProvider(config);
    const client = (provider as unknown as { client: S3Client }).client;
    const sent: unknown[] = [];
    jest.spyOn(client, 'send').mockImplementation((command: unknown) => {
      sent.push(command);
      return send(command) as never;
    });
    return { provider, sent };
  }
  const ok = () => Promise.resolve({});
  const s3Error = (name: string) =>
    new S3ServiceException({ name, $fault: 'client', $metadata: {} });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('upload puts the object in the configured bucket with its content type', async () => {
    const { provider, sent } = s3(ok);

    const result = await provider.uploadFile(bytes(3), 'avatars/u-1.png', {
      contentType: 'image/png',
    });

    expect(result).toEqual({ key: 'avatars/u-1.png', bucket: 'shipping-dev' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect((sent[0] as PutObjectCommand).input).toEqual({
      Bucket: 'shipping-dev',
      Key: 'avatars/u-1.png',
      Body: bytes(3),
      ContentType: 'image/png',
    });
  });

  it('a failed upload becomes 500 (9003) and the S3 error text is not passed on', async () => {
    const { provider } = s3(() =>
      Promise.reject(new Error('AccessDenied: bucket policy for minioadmin')),
    );

    const error = await provider
      .uploadFile(bytes(3), 'k', { contentType: 'image/png' })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(FileUploadFailedException);
    expect((error as DomainException).getStatus()).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(
      JSON.stringify((error as DomainException).getResponse()),
    ).not.toContain('AccessDenied');
  });

  it('delete removes that key from the configured bucket', async () => {
    const { provider, sent } = s3(ok);

    await provider.deleteFile('avatars/u-1.png');

    expect(sent[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((sent[0] as DeleteObjectCommand).input).toEqual({
      Bucket: 'shipping-dev',
      Key: 'avatars/u-1.png',
    });
  });

  it('fileExists: true when found, false on NotFound, an error for anything else', async () => {
    await expect(s3(ok).provider.fileExists('k')).resolves.toBe(true);

    const found = s3(ok);
    await found.provider.fileExists('k');
    expect(found.sent[0]).toBeInstanceOf(HeadObjectCommand);

    await expect(
      s3(() => Promise.reject(s3Error('NotFound'))).provider.fileExists('k'),
    ).resolves.toBe(false);
    await expect(
      s3(() => Promise.reject(s3Error('Forbidden'))).provider.fileExists('k'),
    ).rejects.toBeInstanceOf(FileUploadFailedException);
  });

  it('signed URLs point at the bucket and key and expire after 1 hour by default', async () => {
    const { provider, sent } = s3(ok);

    const url = new URL(await provider.getSignedUrl('shipments/TRK-1/a.png'));
    const custom = new URL(await provider.getSignedUrl('k', 60));

    expect(`${url.origin}${url.pathname}`).toBe(
      'http://localhost:9000/shipping-dev/shipments/TRK-1/a.png',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(custom.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(sent).toEqual([]); // signing never calls S3
  });
});

/** The real UsersController + UsersService over one in-memory user, storing into the in-memory bucket. */
function avatarRoute() {
  const { bucket, files } = storage();
  const users: Partial<User>[] = [
    { id: 'user-1', email: 'maria@example.com', avatarKey: null },
  ];
  const userRepository = {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((u) => u.id === where.id) ?? null),
    update: (id: string, values: Partial<User>) => {
      Object.assign(
        users.find((u) => u.id === id)!,
        values,
      );
      return Promise.resolve({ affected: 1 });
    },
  };
  const usersService = new UsersService(
    userRepository as unknown as Repository<User>,
    {} as CryptoService,
    files,
  );
  const controller = new UsersController(usersService, files);
  const me: RequestUser = {
    id: 'user-1',
    email: 'maria@example.com',
    accountType: AccountType.CUSTOMER,
  };
  const upload = (name: string, mimetype = 'image/png', size = 100) =>
    controller.uploadAvatar(
      {
        buffer: bytes(size),
        originalname: name,
        mimetype,
      } as Express.Multer.File,
      me,
    );
  return { bucket, users, upload, controller, me, usersService };
}

describe('POST /users/profile/avatar', () => {
  it('stores the file, saves only its key on the user, and returns a signed URL', async () => {
    const { bucket, users, upload } = avatarRoute();

    const { avatarUrl } = await upload('me.png');

    const key = users[0].avatarKey!;
    expect(bucket.objects.has(key)).toBe(true);
    expect(avatarUrl).toContain(key);
    expect(key).not.toContain('sig=');
  });

  it('replacing the avatar deletes the old file, so only one is kept', async () => {
    const { bucket, users, upload } = avatarRoute();
    await upload('first.png');
    const firstKey = users[0].avatarKey!;
    await new Promise((resolve) => setTimeout(resolve, 2)); // keys are timestamped

    await upload('second.webp', 'image/webp');

    expect(bucket.objects.has(firstKey)).toBe(false);
    expect([...bucket.objects.keys()]).toEqual([users[0].avatarKey]);
  });

  it('an invalid new avatar is refused and the old one is untouched', async () => {
    const { bucket, users, upload } = avatarRoute();
    await upload('first.png');
    const firstKey = users[0].avatarKey;

    await expectInvalidType(() => upload('cv.pdf', 'application/pdf'));

    expect(users[0].avatarKey).toBe(firstKey);
    expect([...bucket.objects.keys()]).toEqual([firstKey]);
  });

  it('if storage is down, the user keeps the old avatar (500, 9003)', async () => {
    const { bucket, users, upload } = avatarRoute();
    await upload('first.png');
    const firstKey = users[0].avatarKey;
    bucket.failUploads = true;

    await expectStorageError(
      () => upload('second.png'),
      FileUploadFailedException,
      HttpStatus.INTERNAL_SERVER_ERROR,
      FileStorageErrorCodes.FileUploadFailed,
    );
    expect(users[0].avatarKey).toBe(firstKey);
  });

  it('the profile serves a freshly signed URL for the stored key', async () => {
    const { users, upload, usersService } = avatarRoute();
    await upload('me.png');

    const first = await usersService.getProfile('user-1');
    const second = await usersService.getProfile('user-1');

    expect(first.avatarUrl).toContain(users[0].avatarKey);
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
  });
});

describe('current gaps (pinned, not endorsed)', () => {
  it('the type check trusts the declared content type: any bytes labelled image/png are accepted', async () => {
    const { bucket, files } = storage();
    const notAnImage = Buffer.from('<html><script>alert(1)</script></html>');

    const { key } = await files.uploadAvatar(
      notAnImage,
      'user-1',
      'avatar.png',
      'image/png',
    );

    expect(bucket.objects.get(key)?.body).toEqual(notAnImage);
  });

  it('the stored key keeps whatever extension the client sent, even one that does not match the type', async () => {
    const { files } = storage();

    const { key } = await files.uploadAvatar(
      bytes(10),
      'user-1',
      'payload.html',
      'image/png',
    );

    expect(key).toMatch(/\.html$/);
  });

  it('an avatar request with no file crashes (TypeError → 500) instead of a 400', async () => {
    const { controller, me } = avatarRoute();

    await expect(
      controller.uploadAvatar(undefined as unknown as Express.Multer.File, me),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
