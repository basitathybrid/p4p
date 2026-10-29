const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_STORAGE_ROOT = path.resolve(
  process.env.PROFILE_IMAGE_STORAGE_DIR || path.join(__dirname, '..', 'storage', 'profile-pictures'),
);

// When AWS_S3_BUCKET is set, images are stored in S3 instead of the local filesystem.
const S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const S3_PREFIX = String(process.env.AWS_S3_PREFIX || 'profile-pictures').replace(/^\/+|\/+$/g, '');
let s3Client = null;

if (S3_BUCKET) {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
}

const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
};

function getImageType(contentType) {
  return IMAGE_TYPES[String(contentType || '').toLowerCase()] || null;
}

function validateImage(contentType, buffer) {
  const imageType = getImageType(contentType);

  if (!imageType) {
    const error = new Error('Only JPEG, PNG, and WebP images are supported.');
    error.code = 'UNSUPPORTED_IMAGE_TYPE';
    throw error;
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('An image file is required.');
    error.code = 'EMPTY_IMAGE';
    throw error;
  }

  if (buffer.length > MAX_PROFILE_IMAGE_BYTES) {
    const error = new Error('Profile images must be 5 MB or smaller.');
    error.code = 'IMAGE_TOO_LARGE';
    throw error;
  }

  if (!imageType.matches(buffer)) {
    const error = new Error('The uploaded file does not match its image type.');
    error.code = 'INVALID_IMAGE_DATA';
    throw error;
  }

  return imageType;
}

function resolveStoragePath(key) {
  const resolved = path.resolve(PROFILE_IMAGE_STORAGE_ROOT, key);
  const rootWithSeparator = `${PROFILE_IMAGE_STORAGE_ROOT}${path.sep}`;

  if (!resolved.startsWith(rootWithSeparator)) {
    const error = new Error('Invalid profile image key.');
    error.code = 'INVALID_IMAGE_KEY';
    throw error;
  }

  return resolved;
}

async function storeProfileImage(ownerId, contentType, buffer, accountType = 'supervisors') {
  const imageType = validateImage(contentType, buffer);
  if (!['supervisors', 'customers', 'basic_users'].includes(accountType)) {
    const error = new Error('Invalid profile image account type.');
    error.code = 'INVALID_ACCOUNT_TYPE';
    throw error;
  }
  const ownerKey = accountType === 'customers'
    ? crypto.createHash('sha256').update(String(ownerId)).digest('hex')
    : String(ownerId);
  const key = `${accountType}/${ownerKey}/${crypto.randomUUID()}.${imageType.extension}`;

  if (s3Client) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `${S3_PREFIX}/${key}`,
      Body: buffer,
      ContentType: contentType,
    }));
    return key;
  }

  const filePath = resolveStoragePath(key);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer, { flag: 'wx' });

  return key;
}

async function removeProfileImage(key) {
  if (!key) return;

  if (s3Client) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: `${S3_PREFIX}/${key}` }));
    return;
  }

  await fs.rm(resolveStoragePath(key), { force: true });
}

async function openProfileImage(key) {
  if (!key) return null;

  if (s3Client) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    try {
      const object = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${S3_PREFIX}/${key}` }));
      return { body: await object.Body.transformToByteArray(), contentType: contentTypeForKey(key) };
    } catch (error) {
      // Without s3:ListBucket permission, S3 returns AccessDenied (403) instead of
      // NoSuchKey (404) for missing keys — treat both as "not found".
      if (['NoSuchKey', 'AccessDenied', 'NotFound'].includes(error.name)) return null;
      if ([403, 404].includes(error.$metadata?.httpStatusCode)) return null;
      throw error;
    }
  }

  const filePath = resolveStoragePath(key);
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  return { filePath, contentType: contentTypeForKey(key) };
}

function contentTypeForKey(key) {
  const extension = path.extname(key).toLowerCase();
  return extension === '.jpg' || extension === '.jpeg'
    ? 'image/jpeg'
    : extension === '.png'
      ? 'image/png'
      : 'image/webp';
}

module.exports = {
  MAX_PROFILE_IMAGE_BYTES,
  getImageType,
  validateImage,
  storeProfileImage,
  removeProfileImage,
  openProfileImage,
  isS3Enabled: () => Boolean(s3Client),
};