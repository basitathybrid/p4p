const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_STORAGE_ROOT = path.resolve(
  process.env.PROFILE_IMAGE_STORAGE_DIR || path.join(__dirname, '..', 'storage', 'profile-pictures'),
);

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

async function storeProfileImage(supervisorId, contentType, buffer) {
  const imageType = validateImage(contentType, buffer);
  const key = `supervisors/${String(supervisorId)}/${crypto.randomUUID()}.${imageType.extension}`;
  const filePath = resolveStoragePath(key);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer, { flag: 'wx' });

  return key;
}

async function removeProfileImage(key) {
  if (!key) return;

  await fs.rm(resolveStoragePath(key), { force: true });
}

async function openProfileImage(key) {
  if (!key) return null;

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
};