const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./db');
const { migrateDatabase } = require('./database/migrate');
const { startOtpVerification, checkOtpVerification, sendReviewDecisionSms } = require('./services/twilioService');
const { sendTemporaryPasswordEmail } = require('./services/emailService');
const { signCustomerToken, signSupervisorToken, signBasicUserToken, requireCustomerAuth, requireSupervisorAuth, requireAuth } = require('./auth');
const { importTransactions } = require('./transactionService');
const { TIER_RANK, getTierThresholds, tierForVolume, validateThresholds } = require('./tierService');
const {
  MAX_PROFILE_IMAGE_BYTES,
  storeProfileImage,
  removeProfileImage,
  openProfileImage,
} = require('./services/profileImageStorage');
const { getSupervisorProfile, setSupervisorProfileImage } = require('./services/supervisorProfileService');
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
  createCustomerPasswordReset,
  updateCustomerPassword,
} = require('./signupService');

const app = express();
const PORT = process.env.PORT || 5000;
const profileImageBodyParser = express.raw({ type: '*/*', limit: MAX_PROFILE_IMAGE_BYTES });

app.use(cors());
app.use(express.json());
app.use(express.text({ type: ['text/csv', 'application/csv'] }));

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

async function loginBasicUser(identifier, password) {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier || !password) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  const [rows] = await db.query(
    `SELECT id, full_name AS name, username, email, password_hash, role
     FROM basic_users
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
      role: rows[0].role || 'basic',
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

    if (!/^[A-Za-z][A-Za-z '.-]*$/.test(String(payload.name).trim())) {
      return res.status(400).json({ success: false, code: 'INVALID_NAME', message: 'Name must contain letters only.' });
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
    if (error.code === 'INVALID_PHONE') {
      return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: error.message });
    }

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
    const { phone, email, username, identifier, password, portal } = req.body || {};
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

    const basicUserResult = await loginBasicUser(loginIdentifier, password);

    if (basicUserResult.success) {
      const token = signBasicUserToken(basicUserResult.user);

      return res.status(200).json({
        success: true,
        token,
        role: 'basic',
        user: basicUserResult.user,
      });
    }

    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: portal === 'supervisor' || portal === 'basic'
        ? 'Username/email or password is incorrect.'
        : 'Phone number or password is incorrect.',
    });
  } catch (error) {
    console.error('login failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to log in.', error: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const genericResponse = {
    success: true,
    message: 'If an account matches that email address, a temporary password has been sent.',
  };

  try {
    const reset = await createCustomerPasswordReset(req.body?.email);

    if (!reset.success) {
      return res.status(200).json(genericResponse);
    }

    // persist the new password before emailing it so a failed send never leaves a stale hash
    await updateCustomerPassword(reset.phone, reset.temporaryPassword);
    await sendTemporaryPasswordEmail(reset);
    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('password reset failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to process the password reset request. Please try again later.' });
  }
});

app.post('/api/auth/change-password', requireAuth(), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Current and new password are required.' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, code: 'INVALID_PASSWORD', message: 'New password must be at least 8 characters.' });
    }

    if (req.user.role === 'supervisor') {
      const [rows] = await db.query('SELECT password_hash FROM supervisors WHERE id = ?', [req.user.id]);

      if (!rows[0] || !(await bcrypt.compare(String(oldPassword), rows[0].password_hash))) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);
      await db.query('UPDATE supervisors SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
      return res.status(200).json({ success: true, message: 'Password updated successfully.' });
    }

    if (req.user.role === 'basic') {
      const [rows] = await db.query('SELECT password_hash FROM basic_users WHERE id = ?', [req.user.id]);

      if (!rows[0] || !(await bcrypt.compare(String(oldPassword), rows[0].password_hash))) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);
      await db.query('UPDATE basic_users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
      return res.status(200).json({ success: true, message: 'Password updated successfully.' });
    }

    const [rows] = await db.query('SELECT password_hash FROM customers WHERE phone = ?', [req.customerPhone]);

    if (!rows[0] || !(await bcrypt.compare(String(oldPassword), rows[0].password_hash))) {
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });
    }

    await updateCustomerPassword(req.customerPhone, newPassword);
    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('change password failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to change password.', error: error.message });
  }
});

app.get('/api/supervisor/profile', requireSupervisorAuth, async (req, res) => {
  try {
    const profile = await getSupervisorProfile(req.user.id);

    if (!profile) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile not found.' });
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...profile,
        profileImageKey: undefined,
        profilePictureUrl: profile.profileImageKey ? '/api/supervisor/profile-picture' : null,
      },
    });
  } catch (error) {
    console.error('load supervisor profile failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load supervisor profile.', error: error.message });
  }
});

app.get('/api/supervisor/profile-picture', requireSupervisorAuth, async (req, res, next) => {
  try {
    const profile = await getSupervisorProfile(req.user.id);

    if (!profile || !profile.profileImageKey) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile picture not found.' });
    }

    const image = await openProfileImage(profile.profileImageKey);
    if (!image) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile picture not found.' });
    }

    res.type(image.contentType);
    res.set('Cache-Control', 'private, max-age=300');
    return res.sendFile(image.filePath);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/supervisor/profile-picture', requireSupervisorAuth, profileImageBodyParser, async (req, res) => {
  let newImageKey;

  try {
    const supervisorId = req.user.id;
    const profile = await getSupervisorProfile(supervisorId);

    if (!profile) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile not found.' });
    }

    newImageKey = await storeProfileImage(supervisorId, req.headers['content-type'], req.body);
    const updated = await setSupervisorProfileImage(supervisorId, newImageKey);

    if (!updated) {
      const error = new Error('Supervisor profile not found.');
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (profile.profileImageKey) {
      try {
        await removeProfileImage(profile.profileImageKey);
      } catch (error) {
        console.error('remove previous supervisor profile picture failed:', error);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Supervisor profile picture updated.',
      profilePictureUrl: '/api/supervisor/profile-picture',
    });
  } catch (error) {
    if (newImageKey) {
      try {
        await removeProfileImage(newImageKey);
      } catch (cleanupError) {
        console.error('remove failed supervisor profile picture upload failed:', cleanupError);
      }
    }

    const statusCode = {
      NOT_FOUND: 404,
      UNSUPPORTED_IMAGE_TYPE: 415,
      EMPTY_IMAGE: 400,
      IMAGE_TOO_LARGE: 413,
      INVALID_IMAGE_DATA: 400,
    }[error.code] || 500;
    const message = statusCode === 500 ? 'Unable to update supervisor profile picture.' : error.message;
    console.error('update supervisor profile picture failed:', error);
    return res.status(statusCode).json({ success: false, code: error.code || 'SERVER_ERROR', message });
  }
});

app.delete('/api/supervisor/profile-picture', requireSupervisorAuth, async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const profile = await getSupervisorProfile(supervisorId);

    if (!profile) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile not found.' });
    }

    if (!profile.profileImageKey) {
      return res.status(200).json({ success: true, message: 'Supervisor profile picture removed.' });
    }

    const updated = await setSupervisorProfileImage(supervisorId, null);
    if (!updated) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Supervisor profile not found.' });
    }

    try {
      await removeProfileImage(profile.profileImageKey);
    } catch (error) {
      console.error('remove supervisor profile picture failed:', error);
    }

    return res.status(200).json({ success: true, message: 'Supervisor profile picture removed.' });
  } catch (error) {
    console.error('delete supervisor profile picture failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to remove supervisor profile picture.', error: error.message });
  }
});

app.get('/api/customer/session', requireCustomerAuth, async (req, res) => {
  try {
    const application = await getApplication(req.customerPhone);

    if (!application) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Application not found.' });
    }

    const [usageRows] = await db.query(
      `SELECT lifetime_transaction_volume, transaction_count, last_activity_at,
              COALESCE(tier_override, reward_tier) AS reward_tier,
              reward_tier AS original_reward_tier,
              tier_override
       FROM customer_usage WHERE phone = ?`,
      [req.customerPhone]
    );
    const [transactionRows] = await db.query(
      `SELECT transaction_datetime, transaction_type, transaction_amount, transaction_status, transaction_id
       FROM transactions WHERE phone = ? ORDER BY transaction_datetime DESC LIMIT 10`,
      [req.customerPhone]
    );
    const [tierThresholds] = await db.query(
      'SELECT tier_name AS name, minimum_volume AS minimum FROM tier_thresholds ORDER BY minimum_volume ASC'
    );

    // Profile details are view-only for the customer; edits are made only by PayFe Operations via the review endpoints.
    return res.status(200).json({
      success: true,
      status: application.status,
      application,
      usage: usageRows[0] || {
        lifetime_transaction_volume: 0,
        transaction_count: 0,
        last_activity_at: null,
        reward_tier: 'Bronze',
        original_reward_tier: 'Bronze',
        tier_override: null,
      },
      tierThresholds,
      transactions: transactionRows,
    });
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

app.get('/api/basic/customers', requireAuth(), async (req, res) => {
  if (req.user.role !== 'basic') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  try {
    const [customers] = await db.query(
      `SELECT a.name, a.phone, a.email,
              a.player_mobile_id AS playerMobileId, a.player_id AS playerId,
              COALESCE(u.tier_override, u.reward_tier, 'Bronze') AS rewardTier,
              COALESCE(u.reward_tier, 'Bronze') AS originalTier,
              COALESCE(u.lifetime_transaction_volume, 0) AS lifetimeVolume,
              COALESCE(u.transaction_count, 0) AS transactionCount,
              u.last_activity_at AS lastActivityAt
       FROM applications a
       LEFT JOIN customer_usage u ON u.phone = a.phone
       WHERE a.status = 'approved'
       ORDER BY a.name ASC`
    );
    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error('load basic user customers failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load approved customers.' });
  }
});

app.get('/api/tier-thresholds', requireAuth(), async (req, res) => {
  if (!['supervisor', 'basic'].includes(req.user.role)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  try {
    const conn = await db.getConnection();
    try {
      return res.status(200).json({ success: true, thresholds: await getTierThresholds(conn) });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('load tier thresholds failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load tier thresholds.' });
  }
});

app.put('/api/tier-thresholds', requireAuth(), async (req, res) => {
  if (!['supervisor', 'basic'].includes(req.user.role)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  const thresholds = (req.body?.thresholds || []).map((tier) => ({ name: tier.name, minimum: Number(tier.minimum) }));
  if (!validateThresholds(thresholds) || thresholds.some((tier) => !Number.isFinite(tier.minimum) || tier.minimum < 0)) {
    return res.status(400).json({ success: false, code: 'INVALID_THRESHOLDS', message: 'Tier thresholds must contain Bronze, Silver, Gold and Diamond in increasing order.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const tier of thresholds) {
      await conn.query('UPDATE tier_thresholds SET minimum_volume = ? WHERE tier_name = ?', [tier.minimum, tier.name]);
    }
    const [usageRows] = await conn.query('SELECT phone, lifetime_transaction_volume FROM customer_usage');
    for (const usage of usageRows) {
      await conn.query('UPDATE customer_usage SET reward_tier = ? WHERE phone = ?', [tierForVolume(usage.lifetime_transaction_volume, thresholds), usage.phone]);
    }
    await conn.commit();
    return res.status(200).json({ success: true, thresholds });
  } catch (error) {
    await conn.rollback();
    console.error('update tier thresholds failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to update tier thresholds.' });
  } finally {
    conn.release();
  }
});

app.get('/api/review/customers/manual-tiers', requireSupervisorAuth, async (req, res) => {
  try {
    const [customers] = await db.query(
            `SELECT a.name, a.phone, u.tier_override AS rewardTier,
              u.reward_tier AS originalTier,
              u.lifetime_transaction_volume AS lifetimeVolume,
              u.transaction_count AS transactionCount,
              u.last_activity_at AS lastActivityAt,
              u.tier_override_by AS changedBy
       FROM customer_usage u
       JOIN applications a ON a.phone = u.phone
       WHERE u.tier_override IS NOT NULL
       ORDER BY u.updated_at DESC, a.name ASC`
    );
    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error('load manually changed customer tiers failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to load manually changed customer tiers.' });
  }
});

app.post('/api/review/customers/:phone/tier', requireSupervisorAuth, async (req, res) => {
  const tier = String(req.body?.tier || '');
  if (!Object.prototype.hasOwnProperty.call(TIER_RANK, tier)) {
    return res.status(400).json({ success: false, code: 'INVALID_TIER', message: 'Select a valid customer tier.' });
  }

  try {
    const conn = await db.getConnection();
    try {
      const [usageRows] = await conn.query('SELECT lifetime_transaction_volume, reward_tier FROM customer_usage WHERE phone = ?', [normalizePhone(req.params.phone)]);
      if (!usageRows[0]) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Customer usage not found.' });
      const thresholds = await getTierThresholds(conn);
      const automaticTier = tierForVolume(usageRows[0].lifetime_transaction_volume, thresholds);
      if (TIER_RANK[tier] >= TIER_RANK[automaticTier]) {
        return res.status(400).json({ success: false, code: 'NOT_A_DOWNGRADE', message: `Customer automatically qualifies for ${automaticTier} and can only be manually downgraded.` });
      }
      await conn.query(
        'UPDATE customer_usage SET tier_override = ?, tier_override_by = ? WHERE phone = ?',
        [tier, req.user.name || req.user.username || 'Supervisor', normalizePhone(req.params.phone)]
      );
      return res.status(200).json({ success: true, tier });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('update customer tier failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to update customer tier.' });
  }
});

app.post('/api/review/customers/:phone/tier/revert', requireSupervisorAuth, async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [usageRows] = await conn.query(
      'SELECT lifetime_transaction_volume FROM customer_usage WHERE phone = ? AND tier_override IS NOT NULL',
      [phone]
    );
    if (!usageRows[0]) {
      await conn.rollback();
      return res.status(404).json({ success: false, code: 'NO_TIER_OVERRIDE', message: 'No manual tier override exists for this customer.' });
    }

    const thresholds = await getTierThresholds(conn);
    const tier = tierForVolume(usageRows[0].lifetime_transaction_volume, thresholds);
    await conn.query(
      'UPDATE customer_usage SET reward_tier = ?, tier_override = NULL, tier_override_by = NULL WHERE phone = ?',
      [tier, phone]
    );
    await conn.commit();
    return res.status(200).json({ success: true, tier });
  } catch (error) {
    await conn.rollback();
    console.error('revert customer tier override failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to revert customer tier.' });
  } finally {
    conn.release();
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

app.post('/api/uploads/transactions', requireSupervisorAuth, async (req, res) => {
  try {
    const csv = typeof req.body === 'string' ? req.body : req.body?.csv;
    const result = await importTransactions(csv);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({ success: true, message: 'Transaction upload processed.', ...result });
  } catch (error) {
    console.error('transaction upload failed:', error);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Unable to process transaction upload.' });
  }
});

app.get('/api/signup/registered-phones', async (req, res) => {
  const phones = await getRegisteredPhones();
  res.json({ phones });
});

app.get('/', (req, res) => {
  res.json({ message: 'P4P server is running' });
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, code: 'IMAGE_TOO_LARGE', message: 'Profile images must be 5 MB or smaller.' });
  }

  return next(error);
});

async function startServer() {
  await migrateDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Database migration failed. Server was not started.', error);
  process.exitCode = 1;
});
