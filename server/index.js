const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const { sendOtpSms, sendReviewDecisionSms } = require('./services/twilioService');
const { signCustomerToken, requireCustomerAuth } = require('./auth');
const {
  createSignupSession,
  verifySignupOtp,
  normalizePhone,
  getApplication,
  listApplications,
  updateApplication,
  decideApplication,
  getRegisteredPhones,
  loginCustomer,
} = require('./signupService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function isSupervisorUser(req) {
  const role = String(req.header('x-user-role') || '').trim().toLowerCase();
  return role === 'supervisor' || role === 'payfe supervisor user';
}

function requireSupervisor(req, res, next) {
  if (!isSupervisorUser(req)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Only PayFe Supervisor Users may perform review actions.',
    });
  }

  return next();
}

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Database connection failed', error: error.message });
  }
});

app.post('/api/signup/request', async (req, res) => {
  try {
    const payload = req.body || {};
    const phone = normalizePhone(payload.phone);

    if (!payload.name || !phone || !payload.email) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Name, phone, and email are required.' });
    }

    const created = await createSignupSession({
      name: payload.name,
      phone,
      email: payload.email,
      password: payload.password,
      playerMobileId: payload.playerMobileId || '',
      facebook: payload.facebook || '',
      instagram: payload.instagram || '',
      telegram: payload.telegram || '',
    });

    if (!created.success) {
      const statusCode = created.code === 'PHONE_EXISTS' ? 409 : 400;
      const message = created.code === 'INVALID_PASSWORD'
        ? 'Password must be at least 8 characters.'
        : created.code === 'PHONE_EXISTS'
          ? 'This phone number is already registered.'
          : 'Unable to create signup request.';
      return res.status(statusCode).json({ ...created, message });
    }

    const smsResult = await sendOtpSms(phone, created.otpCode);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to phone number.',
      phone,
      sms: smsResult,
      expiresInMinutes: created.expiresInMinutes,
      sessionId: created.sessionId,
    });
  } catch (error) {
    console.error('signup request failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to create signup request.', error: error.message });
  }
});

app.post('/api/signup/verify', async (req, res) => {
  try {
    const { phone, otpCode } = req.body || {};
    const result = await verifySignupOtp(phone, otpCode);

    if (!result.success) {
      const statusCode = result.code === 'LOCKED' ? 423 : result.code === 'OTP_EXPIRED' ? 410 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified. Application is now pending review.',
      status: 'pending_review',
      phone: normalizePhone(phone),
      application: result.application,
    });
  } catch (error) {
    console.error('signup verification failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to verify OTP.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const result = await loginCustomer(phone, password);

    if (!result.success) {
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Phone number or password is incorrect.' });
    }

    const application = await getApplication(result.phone);
    const token = signCustomerToken(result.phone);

    return res.status(200).json({
      success: true,
      token,
      phone: result.phone,
      status: application ? application.status : null,
    });
  } catch (error) {
    console.error('login failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to log in.', error: error.message });
  }
});

app.get('/api/customer/session', requireCustomerAuth, async (req, res) => {
  try {
    const application = await getApplication(req.customerPhone);

    if (!application) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Application not found.' });
    }

    // Profile details are view-only for the customer; edits are made only by PayFe Operations via the review endpoints.
    return res.status(200).json({ success: true, status: application.status, application });
  } catch (error) {
    console.error('load customer session failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load account status.', error: error.message });
  }
});

app.get('/api/review/applications', requireSupervisor, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const applications = await listApplications(status);
    return res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error('list applications failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load applications.', error: error.message });
  }
});

app.get('/api/review/applications/:phone', requireSupervisor, async (req, res) => {
  try {
    const application = await getApplication(req.params.phone);

    if (!application) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Application not found.' });
    }

    return res.status(200).json({ success: true, application });
  } catch (error) {
    console.error('get application failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load application.', error: error.message });
  }
});

app.patch('/api/review/applications/:phone', requireSupervisor, async (req, res) => {
  try {
    const result = await updateApplication(req.params.phone, req.body || {});

    if (!result.success) {
      const statusCode = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(statusCode).json({
        ...result,
        message: result.code === 'REVIEW_CLOSED'
          ? 'Submitted customer data can only be edited before a decision is made.'
          : 'Application not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Application details updated.',
      application: result.application,
    });
  } catch (error) {
    console.error('update application failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to update application.', error: error.message });
  }
});

app.post('/api/review/applications/:phone/decision', requireSupervisor, async (req, res) => {
  try {
    const decision = String(req.body?.decision || '').toLowerCase();
    const reviewer = req.body?.reviewer || 'PayFe Supervisor';
    const result = await decideApplication(req.params.phone, decision, reviewer);

    if (!result.success) {
      let statusCode = 400;

      if (result.code === 'NOT_FOUND') statusCode = 404;
      if (result.code === 'REVIEW_CLOSED') statusCode = 409;

      return res.status(statusCode).json({
        ...result,
        message: result.code === 'INVALID_DECISION'
          ? 'Decision must be Approved or Rejected.'
          : result.code === 'REVIEW_CLOSED'
            ? 'This application has already been reviewed.'
            : 'Application not found.',
      });
    }

    const sms = await sendReviewDecisionSms(result.application.phone, result.application.status);

    return res.status(200).json({
      success: true,
      message: `Application ${result.application.status}.`,
      application: result.application,
      sms,
    });
  } catch (error) {
    console.error('application decision failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to complete review decision.', error: error.message });
  }
});

app.get('/api/signup/registered-phones', async (req, res) => {
  const phones = await getRegisteredPhones();
  res.json({ phones });
});

app.get('/', (req, res) => {
  res.json({ message: 'P4P server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
