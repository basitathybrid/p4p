process.env.PROFILE_IMAGE_STORAGE_DIR = require('path').join(require('os').tmpdir(), `p4p-profile-images-${process.pid}`);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const {
  MAX_PROFILE_IMAGE_BYTES,
  validateImage,
  storeProfileImage,
  openProfileImage,
  removeProfileImage,
} = require('./services/profileImageStorage');

const storageRoot = process.env.PROFILE_IMAGE_STORAGE_DIR;

test.after(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

test('validates image signatures and rejects unsupported data', () => {
  assert.equal(validateImage('image/jpeg', Buffer.from([0xff, 0xd8, 0xff])).extension, 'jpg');
  assert.equal(validateImage('image/png', Buffer.from('89504e470d0a1a0a', 'hex')).extension, 'png');
  assert.equal(validateImage('image/webp', Buffer.from('524946460000000057454250', 'hex')).extension, 'webp');
  assert.throws(() => validateImage('image/png', Buffer.from('not-an-image')), { code: 'INVALID_IMAGE_DATA' });
  assert.throws(() => validateImage('application/pdf', Buffer.from('data')), { code: 'UNSUPPORTED_IMAGE_TYPE' });
});

test('enforces the five megabyte limit', () => {
  assert.throws(
    () => validateImage('image/png', Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(MAX_PROFILE_IMAGE_BYTES)])),
    { code: 'IMAGE_TOO_LARGE' },
  );
});

test('stores, opens, and removes unique supervisor image keys', async () => {
  const image = Buffer.from('89504e470d0a1a0a', 'hex');
  const firstKey = await storeProfileImage(12, 'image/png', image);
  const secondKey = await storeProfileImage(12, 'image/png', image);

  assert.notEqual(firstKey, secondKey);
  assert.match(firstKey, /^supervisors\/12\/[0-9a-f-]+\.png$/);

  const opened = await openProfileImage(firstKey);
  assert.equal(opened.contentType, 'image/png');
  assert.deepEqual(await fs.readFile(path.resolve(storageRoot, firstKey)), image);

  await removeProfileImage(firstKey);
  assert.equal(await openProfileImage(firstKey), null);
  await removeProfileImage(secondKey);
});