const twilio = require('twilio');

function createTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

function toE164Phone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function createVerifyService() {
  const client = createTwilioClient();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!client || !serviceSid) {
    return null;
  }

  return client.verify.v2.services(serviceSid);
}

async function startOtpVerification(phone) {
  const service = createVerifyService();
  const toNumber = toE164Phone(phone);

  if (!service) {
    throw new Error('Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.');
  }

  const verification = await service.verifications.create({ to: toNumber, channel: 'sms' });

  return { ok: true, mode: 'twilio-verify', sid: verification.sid, status: verification.status, to: toNumber };
}

async function checkOtpVerification(phone, otpCode) {
  const service = createVerifyService();
  const toNumber = toE164Phone(phone);

  if (!service) {
    throw new Error('Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.');
  }

  let verificationCheck;

  try {
    verificationCheck = await service.verificationChecks.create({
      to: toNumber,
      code: String(otpCode || ''),
    });
  } catch (error) {
    if ([60200, 60202, 60203].includes(Number(error.code))) {
      return { ok: false, status: 'denied', to: toNumber };
    }

    throw error;
  }

  return {
    ok: verificationCheck.status === 'approved',
    status: verificationCheck.status,
    to: toNumber,
  };
}

async function sendReviewDecisionSms(phone, decision) {
  const client = createTwilioClient();
  const toNumber = toE164Phone(phone);
  const body = decision === 'approved'
    ? 'Your P4P application has been approved. You can now access your approved profile benefits.'
    : 'Your P4P application was not approved. You may update your details and submit the application again.';

  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[mock-sms] Review decision for ${toNumber}: ${decision}`);
    return { ok: true, mode: 'mock', to: toNumber };
  }

  const message = await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber,
  });

  return { ok: true, mode: 'twilio', sid: message.sid, to: toNumber };
}

module.exports = {
  createTwilioClient,
  toE164Phone,
  startOtpVerification,
  checkOtpVerification,
  sendReviewDecisionSms,
};
