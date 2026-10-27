/**
 * Sniffs a file's real type from its first bytes. The declared Content-Type
 * on a multipart upload is whatever the client claims — never trust it for
 * validation, only the bytes that were actually sent.
 */

interface Signature {
  mimeType: string;
  matches: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    mimeType: 'image/jpeg',
    matches: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    matches: (b) =>
      b.length >= 8 &&
      b
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
  },
  {
    mimeType: 'image/gif',
    matches: (b) =>
      b.length >= 6 &&
      ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')),
  },
  {
    mimeType: 'image/webp',
    matches: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mimeType: 'application/pdf',
    matches: (b) => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

/** Returns the detected MIME type, or null if the bytes don't match any known signature. */
export function detectFileType(buffer: Buffer): string | null {
  return SIGNATURES.find((signature) => signature.matches(buffer))?.mimeType ?? null;
}
