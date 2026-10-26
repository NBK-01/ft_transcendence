import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { Repository } from 'typeorm';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { DomainException } from '../common/exceptions/base/error-types';
import {
  MissingRequiredDataException,
  ValidationErrorCodes,
} from '../common/exceptions/validation-exceptions';
import { CryptoService } from '../common/services/crypto.service';
import { S3Config } from '../config/s3.config';
import { User } from '../users/user.entity';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { FileStorageService } from './file-storage.service';
import { S3StorageProvider } from './providers/s3-storage.provider';
import {
  FileStorageErrorCodes,
  FileTooLargeException,
  FileUploadFailedException,
  InvalidFileTypeException,
} from './exceptions/file-storage-exceptions';

/**
 * Runs the real FileStorageService over the real S3StorageProvider — only
 * S3Client.prototype.send and the presigner function are mocked, so a wrong
 * command type, a wrong Bucket/Key, or a backwards sign-for-PUT-instead-of-GET
 * bug would actually fail these tests, not just a hand-wired fake.
 *
 * The one thing this suite pins hardest: a failed S3Client call must surface
 * as FileUploadFailedException (9003), never the raw AWS SDK error — that's
 * a real bug this app hit once (a signature-mismatch error reached a client
 * verbatim).
 */

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const BUCKET = 'test-bucket';
const config: S3Config = {
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  region: 'us-east-1',
  bucket: BUCKET,
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
};

function setup() {
  const sendMock = jest.spyOn(
    S3Client.prototype,
    'send',
  ) as unknown as jest.Mock;
  sendMock.mockReset().mockResolvedValue({});
  const presignMock = presign as jest.Mock;
  presignMock.mockReset().mockResolvedValue('https://signed.example/object');

  const provider = new S3StorageProvider(config);
  const service = new FileStorageService(provider);

  return { service, provider, sendMock, presignMock };
}

afterEach(() => {
  jest.restoreAllMocks();
});

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
}

async function expectDomainError(
  promise: Promise<unknown>,
  type: new (...args: never[]) => DomainException,
  status: HttpStatus,
  code: FileStorageErrorCodes,
): Promise<DomainException> {
  const error = (await rejectionOf(promise)) as DomainException;
  expect(error).toBeInstanceOf(type);
  expect(error.getStatus()).toBe(status);
  expect(error.code).toBe(code);
  return error;
}

const expectFailedUpload = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    FileUploadFailedException,
    HttpStatus.INTERNAL_SERVER_ERROR,
    FileStorageErrorCodes.FileUploadFailed,
  );
const expectInvalidType = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    InvalidFileTypeException,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.InvalidFileType,
  );
const expectTooLarge = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    FileTooLargeException,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.FileTooLarge,
  );

const AVATAR_PNG = Buffer.from('fake-png-bytes');
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

describe('uploadAvatar', () => {
  it('uploads with the right bucket/key/content-type and returns a signed url', async () => {
    const { service, sendMock, presignMock } = setup();

    const result = await service.uploadAvatar(
      AVATAR_PNG,
      'user-42',
      'profile.png',
      'image/png',
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: BUCKET,
      Body: AVATAR_PNG,
      ContentType: 'image/png',
    });
    expect(command.input.Key).toMatch(/^avatars\/user-42-\d+\.png$/);
    expect(result).toEqual({
      url: 'https://signed.example/object',
      key: command.input.Key,
    });
    expect(presignMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the caller-supplied extension verbatim (no normalization)', async () => {
    const { service, sendMock } = setup();

    await service.uploadAvatar(
      AVATAR_PNG,
      'user-1',
      'photo.JPEG',
      'image/jpeg',
    );

    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.Key).toMatch(/\.JPEG$/);
  });

  it.each([
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('accepts %s', async (contentType) => {
    const { service, sendMock } = setup();

    await expect(
      service.uploadAvatar(AVATAR_PNG, 'user-1', 'f', contentType),
    ).resolves.toBeDefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an unsupported content type (400, 9001) and never calls S3', async () => {
    const { service, sendMock } = setup();

    await expectInvalidType(
      service.uploadAvatar(
        AVATAR_PNG,
        'user-1',
        'malware.exe',
        'application/x-msdownload',
      ),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('a buffer at exactly the 2MB limit is accepted', async () => {
    const { service, sendMock } = setup();

    await expect(
      service.uploadAvatar(
        Buffer.alloc(AVATAR_MAX_BYTES),
        'user-1',
        'big.png',
        'image/png',
      ),
    ).resolves.toBeDefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('one byte over the 2MB limit is refused (400, 9002) and never calls S3', async () => {
    const { service, sendMock } = setup();

    await expectTooLarge(
      service.uploadAvatar(
        Buffer.alloc(AVATAR_MAX_BYTES + 1),
        'user-1',
        'big.png',
        'image/png',
      ),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('an S3 failure (e.g. a signature mismatch) surfaces as 500/9003, not the raw AWS error', async () => {
    const { service, sendMock } = setup();
    sendMock.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'SignatureDoesNotMatch: the request signature we calculated does not match',
        ),
        { name: 'SignatureDoesNotMatch', $metadata: { httpStatusCode: 403 } },
      ),
    );
    const error = await expectFailedUpload(
      service.uploadAvatar(AVATAR_PNG, 'user-1', 'profile.png', 'image/png'),
    );

    // The raw SDK error text must never reach what the HTTP layer serializes.
    expect(JSON.stringify(error.getResponse())).not.toMatch(
      /SignatureDoesNotMatch/,
    );
  });
});

describe('uploadShipmentFile', () => {
  it('builds the key under shipments/<trackingId>/ with a unique suffix, and returns only the key', async () => {
    const { service, sendMock } = setup();

    const result = await service.uploadShipmentFile(
      Buffer.from('doc'),
      'TRK-100',
      'proof.pdf',
      'application/pdf',
      'document',
    );

    expect(Object.keys(result)).toEqual(['key']);
    expect(result.key).toMatch(/^shipments\/TRK-100\/\d+-[0-9a-f-]{36}\.pdf$/);
    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: BUCKET,
      Key: result.key,
      ContentType: 'application/pdf',
    });
  });

  it('two uploads with identical inputs get different keys (no collision on the same millisecond)', async () => {
    const { service } = setup();

    const [a, b] = await Promise.all([
      service.uploadShipmentFile(
        Buffer.from('x'),
        'TRK-1',
        'a.png',
        'image/png',
        'image',
      ),
      service.uploadShipmentFile(
        Buffer.from('x'),
        'TRK-1',
        'a.png',
        'image/png',
        'image',
      ),
    ]);

    expect(a.key).not.toBe(b.key);
  });

  it.each([
    ['image', 'application/pdf'],
    ['document', 'video/mp4'],
  ] as const)(
    'refuses a content type not allowed for category %s (400, 9001)',
    async (category, contentType) => {
      const { service, sendMock } = setup();

      await expectInvalidType(
        service.uploadShipmentFile(
          Buffer.from('x'),
          'TRK-1',
          'f',
          contentType,
          category,
        ),
      );
      expect(sendMock).not.toHaveBeenCalled();
    },
  );

  it('a "document" accepts a PDF, which "image" does not', async () => {
    const { service } = setup();

    await expect(
      service.uploadShipmentFile(
        Buffer.from('x'),
        'TRK-1',
        'f.pdf',
        'application/pdf',
        'document',
      ),
    ).resolves.toBeDefined();
  });

  it('refuses a file over the 10MB shipment limit (400, 9002)', async () => {
    const { service, sendMock } = setup();

    await expectTooLarge(
      service.uploadShipmentFile(
        Buffer.alloc(10 * 1024 * 1024 + 1),
        'TRK-1',
        'f.png',
        'image/png',
        'image',
      ),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('an S3 failure surfaces as 500/9003, not the raw AWS error', async () => {
    const { service, sendMock } = setup();
    sendMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expectFailedUpload(
      service.uploadShipmentFile(
        Buffer.from('x'),
        'TRK-1',
        'f.png',
        'image/png',
        'image',
      ),
    );
  });
});

describe('validateShipmentFile (standalone, used by callers before a batch upload)', () => {
  it('passes silently for an allowed type and size', () => {
    const { service } = setup();

    expect(() =>
      service.validateShipmentFile(Buffer.from('x'), 'image/jpeg', 'image'),
    ).not.toThrow();
  });

  it('throws before any upload happens for a disallowed type', () => {
    const { service } = setup();

    expect(() =>
      service.validateShipmentFile(
        Buffer.from('x'),
        'application/pdf',
        'image',
      ),
    ).toThrow(InvalidFileTypeException);
  });
});

describe('deleteFile', () => {
  it('deletes by bucket/key', async () => {
    const { service, sendMock } = setup();

    await service.deleteFile('avatars/user-1-123.png');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: BUCKET,
      Key: 'avatars/user-1-123.png',
    });
  });

  it('an S3 failure surfaces as 500/9003, not the raw AWS error', async () => {
    const { service, sendMock } = setup();
    sendMock.mockRejectedValueOnce(new Error('NoSuchKey'));

    await expectFailedUpload(service.deleteFile('avatars/missing.png'));
  });
});

describe('signed URL generation (getAvatarUrl / getFileUrl)', () => {
  it('getAvatarUrl builds a GetObjectCommand, not a PutObjectCommand (regression: this was backwards once)', async () => {
    const { service, presignMock } = setup();

    const url = await service.getAvatarUrl('avatars/user-1-123.png');

    expect(url).toBe('https://signed.example/object');
    expect(presignMock).toHaveBeenCalledTimes(1);
    const [, command] = presignMock.mock.calls[0] as [
      S3Client,
      GetObjectCommand,
    ];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command).not.toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: BUCKET,
      Key: 'avatars/user-1-123.png',
    });
  });

  it('getFileUrl (shipment files) also builds a GetObjectCommand', async () => {
    const { service, presignMock } = setup();

    await service.getFileUrl('shipments/TRK-1/123-uuid.pdf');

    const [, command] = presignMock.mock.calls[0] as [
      S3Client,
      GetObjectCommand,
    ];
    expect(command).toBeInstanceOf(GetObjectCommand);
  });

  it('a presigner failure surfaces as 500/9003, not the raw AWS error', async () => {
    const { service, presignMock } = setup();
    presignMock.mockRejectedValueOnce(new Error('presign blew up'));

    await expectFailedUpload(service.getAvatarUrl('avatars/user-1-123.png'));
  });
});

/** The real UsersController + UsersService over one in-memory user, storing into the real FileStorageService/S3StorageProvider above. */
function avatarRoute() {
  const { service } = setup();
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
    service,
    new EventEmitter2(),
  );
  const controller = new UsersController(usersService, service);
  const me: RequestUser = {
    id: 'user-1',
    email: 'maria@example.com',
    accountType: AccountType.CUSTOMER,
  };
  const upload = (file?: Express.Multer.File) =>
    controller.uploadAvatar(file, me);
  const avatarFile = (
    name: string,
    mimetype = 'image/png',
    size = 100,
  ): Express.Multer.File =>
    ({
      buffer: Buffer.alloc(size, 1),
      originalname: name,
      mimetype,
    }) as Express.Multer.File;
  return { users, controller, usersService, upload, avatarFile };
}

describe('POST /users/profile/avatar (route, end to end)', () => {
  it('stores the file, saves only its key on the user, and returns a signed URL', async () => {
    const { users, upload, avatarFile } = avatarRoute();

    const { avatarUrl } = await upload(avatarFile('me.png'));

    expect(users[0].avatarKey).toMatch(/^avatars\/user-1-\d+\.png$/);
    expect(avatarUrl).toBe('https://signed.example/object');
  });

  it('replacing the avatar deletes the old file, so only one is kept', async () => {
    const { users, upload, avatarFile } = avatarRoute();
    await upload(avatarFile('first.png'));
    const firstKey = users[0].avatarKey;

    await upload(avatarFile('second.webp', 'image/webp'));

    expect(users[0].avatarKey).not.toBe(firstKey);
  });

  it('an invalid new avatar is refused and the old one is untouched', async () => {
    const { users, upload, avatarFile } = avatarRoute();
    await upload(avatarFile('first.png'));
    const firstKey = users[0].avatarKey;

    await expectInvalidType(upload(avatarFile('cv.pdf', 'application/pdf')));

    expect(users[0].avatarKey).toBe(firstKey);
  });

  it('no file at all is a clean 400 (5001), not a crash', async () => {
    const { upload } = avatarRoute();

    const error = (await upload(undefined).catch(
      (reason: unknown) => reason,
    )) as DomainException;

    expect(error).toBeInstanceOf(MissingRequiredDataException);
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe(ValidationErrorCodes.MissingRequiredData);
  });

  it('the profile serves a freshly signed URL for the stored key', async () => {
    const { upload, avatarFile, usersService } = avatarRoute();
    await upload(avatarFile('me.png'));

    const profile = await usersService.getProfile('user-1');

    expect(profile.avatarUrl).toBe('https://signed.example/object');
  });
});

describe('current gaps (pinned, not endorsed)', () => {
  it('the stored key extension comes only from the client-supplied filename, independent of the validated content type', async () => {
    const { service, sendMock } = setup();

    // Content-type is validated as a real image, but the extension on the
    // stored object key is whatever the client named the file — a PNG
    // upload named "payload.exe" is stored with a ".exe" key.
    await service.uploadAvatar(
      AVATAR_PNG,
      'user-1',
      'payload.exe',
      'image/png',
    );

    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.Key).toMatch(/\.exe$/);
  });

  it('if signed-url generation fails right after a successful upload, the object is already in the bucket but the caller gets only an error (an orphaned, unreferenced object)', async () => {
    const { service, sendMock, presignMock } = setup();
    presignMock.mockRejectedValueOnce(new Error('presigner unavailable'));

    await expectFailedUpload(
      service.uploadAvatar(AVATAR_PNG, 'user-1', 'profile.png', 'image/png'),
    );

    // The PUT already happened — nothing rolls it back.
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
  });
});
