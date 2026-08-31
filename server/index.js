const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./db');
const { startOtpVerification, checkOtpVerification, sendReviewDecisionSms } = require('./services/twilioService');
const { signCustomerToken, signSupervisorToken, requireCustomerAuth, requireSupervisorAuth } = require('./auth');
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
  return role === 'supervisor' || role === 'payfe supervisor user' || req.user?.role === 'supervisor';
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

async function loginSupervisor(identifier, password) {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier || !password) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  const [rows] = await db.query(
    `SELECT id, full_name AS name, username, email, password_hash, role
     FROM supervisors
     WHERE is_active = 1 AND (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?))
     LIMIT 1`,
    [normalizedIdentifier, normalizedIdentifier]
  );

  if (!rows[0]) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  const passwordMatches = await bcrypt.compare(String(password), rows[0].password_hash);

  if (!passwordMatches) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  return {
    success: true,
    user: {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      username: rows[0].username,
      role: rows[0].role || 'supervisor',
    },
  };
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
    const playerId = payload.playerId == null ? '' : String(payload.playerId).trim();

    if (!payload.name || !phone || !payload.email || !String(payload.playerMobileId || '').trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Name, phone, email, and player mobile ID are required.' });
    }

    if (playerId && !/^\d+$/.test(playerId)) {
      return res.status(400).json({ success: false, code: 'INVALID_PLAYER_ID', message: 'Player ID must be numeric.' });
    }

    const created = await createSignupSession({
      name: payload.name,
      phone,
      email: payload.email,
      password: payload.password,
      playerMobileId: payload.playerMobileId,
      playerId: playerId || null,
      facebook: payload.facebook || '',
      instagram: payload.instagram || '',
      telegram: payload.telegram || '',
    });

    if (!created.success) {
      const statusCode = created.code === 'PHONE_EXISTS' ? 409 : created.code === 'SIGNUP_LOCKED' ? 423 : 400;
      const message = created.code === 'INVALID_PASSWORD'
        ? 'Password must be at least 8 characters.'
        : created.code === 'PHONE_EXISTS'
          ? 'This phone number is already registered.'
          : created.code === 'SIGNUP_LOCKED'
            ? 'Signup is temporarily locked after too many incorrect OTP attempts.'
          : 'Unable to create signup request.';
      return res.status(statusCode).json({ ...created, message });
    }

    const verificationResult = await startOtpVerification(phone);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to phone number.',
      phone,
      sms: verificationResult,
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
    const verificationResult = await checkOtpVerification(phone, otpCode);

    if (!verificationResult.ok) {
      const failedAttempt = await verifySignupOtp(phone, otpCode);
      if (failedAttempt.locked) {
        return res.status(423).json(failedAttempt);
      }

      return res.status(400).json({
        success: false,
        code: 'OTP_INVALID',
        message: 'The OTP is invalid or has expired.',
      });
    }

    const result = await verifySignupOtp(phone, otpCode, true);

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
    const { phone, email, username, identifier, password } = req.body || {};
    const loginIdentifier = identifier || phone || username || email;

    const customerResult = await loginCustomer(loginIdentifier, password);

    if (customerResult.success) {
      const application = await getApplication(customerResult.phone);
      const token = signCustomerToken(customerResult.phone);

      return res.status(200).json({
        success: true,
        token,
        role: 'customer',
        phone: customerResult.phone,
        status: application ? application.status : null,
      });
    }

    if (customerResult.code === 'SIGNUP_LOCKED') {
      return res.status(423).json({
        ...customerResult,
        message: 'Signup is temporarily locked after too many incorrect OTP attempts.',
      });
    }

    const supervisorResult = await loginSupervisor(loginIdentifier, password);

    if (supervisorResult.success) {
      const token = signSupervisorToken(supervisorResult.user);

      return res.status(200).json({
        success: true,
        token,
        role: 'supervisor',
        user: supervisorResult.user,
      });
    }

    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Phone number or password is incorrect.' });
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

app.get('/api/review/applications', requireSupervisorAuth, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const applications = await listApplications(status);
    return res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error('list applications failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load applications.', error: error.message });
  }
});

app.get('/api/review/applications/:phone', requireSupervisorAuth, async (req, res) => {
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

app.patch('/api/review/applications/:phone', requireSupervisorAuth, async (req, res) => {
  try {
    const result = await updateApplication(req.params.phone, req.body || {});

    if (!result.success) {
      const statusCode = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(statusCode).json({
        ...result,
        message: result.code === 'REVIEW_CLOSED'
          ? 'Submitted customer data can only be edited before a decision is made.'
          : result.code === 'INVALID_PLAYER_ID'
            ? 'Player ID must be numeric.'
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

app.post('/api/review/applications/:phone/decision', requireSupervisorAuth, async (req, res) => {
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
          : result.code === 'MISSING_REQUIRED_FIELDS'
            ? 'Player ID and Player Mobile ID are required before approval.'
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
