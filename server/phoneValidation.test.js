const test = require('node:test');
const assert = require('node:assert/strict');
const { createSignupSession, isValidUsPhone, normalizePhone } = require('./signupService');

test('US phone validation accepts the signup form formats', () => {
  for (const phone of ['4155550133', '14155550133', '+14155550133']) {
    assert.equal(isValidUsPhone(phone), true);
  }
});

test('US phone validation rejects malformed values before creating a signup session', async () => {
  for (const phone of ['415-555-0133', '415555013', '24155550133', 'phone-number', '']) {
    assert.equal(isValidUsPhone(phone), false);
    const result = await createSignupSession({ phone });
    assert.deepEqual(result, { success: false, code: 'INVALID_PHONE' });
  }
});

test('valid US phone formats normalize to one stored key', () => {
  assert.equal(normalizePhone('4155550133'), normalizePhone('+14155550133'));
});