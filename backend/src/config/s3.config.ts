export const s3Config = () => ({
  endpoint: process.env.AWS_S3_ENDPOINT, // unset = real AWS; set = MinIO/any S3-compatible endpoint
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_S3_BUCKET_NAME,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export type S3Config = ReturnType<typeof s3Config>;
