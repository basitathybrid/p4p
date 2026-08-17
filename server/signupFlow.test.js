const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('./db');
const {
  createSignupSession,
  verifySignupOtp,
  normalizePhone,
  getApplication,
  updateApplication,
  decideApplication,
  listApplications,
  resetSignupState,
} = require('./signupService');

test.after(async () => {
  await resetSignupState();
  await db.end();
});

test.beforeEach(async () => {
  await resetSignupState();
});

test('normalizePhone strips non-digits and keeps a valid E.164-like number', () => {
  assert.equal(normalizePhone('+1 (415) 555-0133'), '14155550133');
  assert.equal(normalizePhone('4155550133'), '4155550133');
});

test('createSignupSession stores a six digit OTP and rejects duplicate phone numbers', async () => {
  const first = await createSignupSession({
    name: 'Ava Johnson',
    phone: '+1 (415) 555-0133',
    email: 'ava@example.com',
    password: 'SuperSecret1',
    playerMobileId: 'M-120-777-872',
  });

  assert.equal(first.success, true);
  assert.match(String(first.otpCode), /^[0-9]{6}$/);

  const second = await createSignupSession({
    name: 'Another User',
    phone: '+1 (415) 555-0133',
    email: 'other@example.com',
    password: 'AnotherSecret1',
  });

  assert.equal(second.success, false);
  assert.equal(second.code, 'PHONE_EXISTS');
});

test('verifySignupOtp increments attempts and locks after three invalid attempts', async () => {
  await createSignupSession({
    name: 'Mia Thompson',
    phone: '+1 (310) 555-0199',
    email: 'mia@example.com',
    password: 'SuperSecret1',
  });

  const wrong1 = await verifySignupOtp('+1 (310) 555-0199', '000000');
  assert.equal(wrong1.success, false);
  assert.equal(wrong1.attempts, 1);

  const wrong2 = await verifySignupOtp('+1 (310) 555-0199', '111111');
  assert.equal(wrong2.success, false);
  assert.equal(wrong2.attempts, 2);

  const wrong3 = await verifySignupOtp('+1 (310) 555-0199', '222222');
  assert.equal(wrong3.success, false);
  assert.equal(wrong3.locked, true);
  assert.equal(wrong3.attempts, 3);
});

test('verified signup enters pending review and can be edited only before decision', async () => {
  const created = await createSignupSession({
    name: 'Taylor Reed',
    phone: '+1 (212) 555-0188',
    email: 'taylor@example.com',
    password: 'SuperSecret1',
    playerMobileId: 'M-1',
    facebook: 'fb.com/taylor',
    instagram: '@taylor',
    telegram: '@taylor_tg',
  });

  const verified = await verifySignupOtp('+1 (212) 555-0188', created.otpCode);
  assert.equal(verified.success, true);
  assert.equal(verified.status, 'pending_review');

  const pending = await listApplications('pending_review');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].phone, '12125550188');

  const updated = await updateApplication('+1 (212) 555-0188', {
    name: 'Taylor Reed Jr.',
    instagram: '@updatedtaylor',
  });

  assert.equal(updated.success, true);
  assert.equal(updated.application.name, 'Taylor Reed Jr.');
  assert.equal(updated.application.instagram, '@updatedtaylor');

  const decided = await decideApplication('+1 (212) 555-0188', 'approved', 'Maria Rodriguez');
  assert.equal(decided.success, true);
  assert.equal(decided.application.status, 'approved');
  assert.equal(decided.application.review.reviewer, 'Maria Rodriguez');

  const afterDecisionEdit = await updateApplication('+1 (212) 555-0188', {
    name: 'Should Fail',
  });
  assert.equal(afterDecisionEdit.success, false);
  assert.equal(afterDecisionEdit.code, 'REVIEW_CLOSED');
});

test('rejected profile can resubmit with same phone and reuses the existing profile', async () => {
  const first = await createSignupSession({
    name: 'Drew Parker',
    phone: '+1 (646) 555-0102',
    email: 'drew@example.com',
    password: 'SuperSecret1',
  });

  const firstVerified = await verifySignupOtp('+1 (646) 555-0102', first.otpCode);
  const rejected = await decideApplication('+1 (646) 555-0102', 'rejected', 'Supervisor A');

  assert.equal(firstVerified.success, true);
  assert.equal(rejected.success, true);
  assert.equal(rejected.application.status, 'rejected');

  const resubmitted = await createSignupSession({
    name: 'Drew Parker Updated',
    phone: '+1 (646) 555-0102',
    email: 'drew.updated@example.com',
    password: 'UpdatedSecret1',
    telegram: '@drew_new',
  });

  assert.equal(resubmitted.success, true);

  const secondVerified = await verifySignupOtp('+1 (646) 555-0102', resubmitted.otpCode);
  assert.equal(secondVerified.success, true);
  assert.equal(secondVerified.application.status, 'pending_review');
  assert.equal(secondVerified.application.name, 'Drew Parker Updated');
  assert.equal(secondVerified.application.email, 'drew.updated@example.com');
  assert.equal(secondVerified.application.telegram, '@drew_new');

  const application = await getApplication('+1 (646) 555-0102');
  assert.equal(application.status, 'pending_review');
  assert.equal(application.review, null);
  assert.equal(application.profileId, rejected.application.profileId);
});
