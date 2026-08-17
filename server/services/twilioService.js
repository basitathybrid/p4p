const twilio = require('twilio');

function createTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

async function sendOtpSms(phone, otpCode) {
  const client = createTwilioClient();
  const toNumber = phone.startsWith('+') ? phone : `+${phone}`;

  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[mock-sms] OTP for ${toNumber}: ${otpCode}`);
    return { ok: true, mode: 'mock' };
  }

  const message = await client.messages.create({
    body: `Your P4P signup code is ${otpCode}. It expires in 30 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber,
  });

  return { ok: true, mode: 'twilio', sid: message.sid };
}

async function sendReviewDecisionSms(phone, decision) {
  const client = createTwilioClient();
  const toNumber = phone.startsWith('+') ? phone : `+${phone}`;
  const body = decision === 'approved'
    ? 'Your P4P application has been approved. You can now access your approved profile benefits.'
    : 'Your P4P application was not approved. You may update your details and submit the application again.';

  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[mock-sms] Review decision for ${toNumber}: ${decision}`);
    return { ok: true, mode: 'mock' };
  }

  const message = await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber,
  });

  return { ok: true, mode: 'twilio', sid: message.sid };
}

module.exports = {
  createTwilioClient,
  sendOtpSms,
  sendReviewDecisionSms,
};
