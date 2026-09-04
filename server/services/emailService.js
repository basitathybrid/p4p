const sgMail = require('@sendgrid/mail');

function isEmailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

async function sendTemporaryPasswordEmail({ email, name, temporaryPassword }) {
  if (!isEmailConfigured()) {
    throw new Error('SendGrid is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.');
  }

  const to = String(email || '').trim();
  if (!to) {
    throw new Error('A recipient email address is required to send a password reset.');
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Your Play4Perks temporary password',
      text: `Hello ${name || 'there'},\n\nYour Play4Perks password has been reset. Use this temporary password to sign in:\n\n${temporaryPassword}\n\nFor your security, change it after signing in. If you did not request this reset, contact support immediately.`,
    });
  } catch (error) {
    const sendGridMessage = error.response?.body?.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join(' ');
    throw new Error(sendGridMessage || 'SendGrid rejected the password reset email.');
  }
}

module.exports = { sendTemporaryPasswordEmail };