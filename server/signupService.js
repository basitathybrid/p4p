const bcrypt = require('bcryptjs');
const db = require('./db');

const MAX_ATTEMPTS = 3;
const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL_SECONDS = 30 * 60;
const LOCKOUT_SECONDS = 30 * 60;

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits : digits;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)).padStart(6, '0');
}

function mapApplicationRow(row) {
  if (!row) return null;

  return {
    profileId: row.profile_id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    playerMobileId: row.player_mobile_id,
    facebook: row.facebook,
    instagram: row.instagram,
    telegram: row.telegram,
    status: row.status,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
    review: row.review_decision
      ? { decision: row.review_decision, reviewer: row.review_reviewer }
      : null,
  };
}

async function getApplication(phone) {
  const normalizedPhone = normalizePhone(phone);
  const [rows] = await db.query('SELECT * FROM applications WHERE phone = ?', [normalizedPhone]);
  return mapApplicationRow(rows[0]);
}

async function listApplications(status) {
  const [rows] = status
    ? await db.query('SELECT * FROM applications WHERE status = ? ORDER BY submitted_at DESC', [status])
    : await db.query('SELECT * FROM applications ORDER BY submitted_at DESC');

  return rows.map(mapApplicationRow);
}

async function getRegisteredPhones() {
  const [rows] = await db.query("SELECT phone FROM applications WHERE status = 'approved'");
  return rows.map((row) => row.phone);
}

async function loginCustomer(phone, password) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !password) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  const [rows] = await db.query('SELECT password_hash FROM customers WHERE phone = ?', [normalizedPhone]);

  if (!rows[0]) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  const passwordMatches = await bcrypt.compare(String(password), rows[0].password_hash);

  if (!passwordMatches) {
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  return { success: true, phone: normalizedPhone };
}

async function createSignupSession(payload) {
  const phone = normalizePhone(payload.phone);

  if (!phone) {
    return { success: false, code: 'INVALID_PHONE' };
  }

  if (!payload.password || String(payload.password).length < MIN_PASSWORD_LENGTH) {
    return { success: false, code: 'INVALID_PASSWORD' };
  }

  const otpCode = generateOtpCode();
  const passwordHash = await bcrypt.hash(String(payload.password), 10);
  const conn = await db.getConnection();

  try {
    await conn.query(
      'CALL sp_start_signup(?, ?, ?, ?, ?, ?, ?, ?, ?, @p_result_code, @p_profile_id)',
      [
        phone,
        payload.name || '',
        payload.email || '',
        payload.playerMobileId || '',
        payload.facebook || '',
        payload.instagram || '',
        payload.telegram || '',
        passwordHash,
        otpCode,
      ]
    );

    const [[outParams]] = await conn.query('SELECT @p_result_code AS result_code, @p_profile_id AS profile_id');

    if (outParams.result_code !== 'OK') {
      return { success: false, code: outParams.result_code };
    }

    return {
      success: true,
      phone,
      otpCode,
      expiresInMinutes: 30,
      sessionId: phone,
    };
  } finally {
    conn.release();
  }
}

async function verifySignupOtp(phone, otpCode) {
  const normalizedPhone = normalizePhone(phone);
  const conn = await db.getConnection();

  try {
    await conn.query(
      'CALL sp_verify_otp(?, ?, ?, ?, ?, @p_result_code, @p_attempts, @p_locked, @p_retry_after_seconds)',
      [normalizedPhone, otpCode == null ? '' : String(otpCode), MAX_ATTEMPTS, SESSION_TTL_SECONDS, LOCKOUT_SECONDS]
    );

    const [[outParams]] = await conn.query(
      'SELECT @p_result_code AS result_code, @p_attempts AS attempts, @p_locked AS locked, @p_retry_after_seconds AS retry_after_seconds'
    );

    const attempts = outParams.attempts || 0;

    if (outParams.result_code !== 'OK') {
      return {
        success: false,
        code: outParams.result_code,
        attempts,
        locked: Boolean(outParams.locked),
        retryAfterSeconds: outParams.retry_after_seconds || 0,
      };
    }

    const application = await getApplication(normalizedPhone);

    return {
      success: true,
      phone: normalizedPhone,
      status: 'pending_review',
      attempts,
      application,
    };
  } finally {
    conn.release();
  }
}

async function updateApplication(phone, updates) {
  const normalizedPhone = normalizePhone(phone);
  const existing = await getApplication(normalizedPhone);

  if (!existing) {
    return { success: false, code: 'NOT_FOUND' };
  }

  const merged = {
    name: updates.name !== undefined ? updates.name || '' : existing.name,
    email: updates.email !== undefined ? updates.email || '' : existing.email,
    playerMobileId: updates.playerMobileId !== undefined ? updates.playerMobileId || '' : existing.playerMobileId,
    facebook: updates.facebook !== undefined ? updates.facebook || '' : existing.facebook,
    instagram: updates.instagram !== undefined ? updates.instagram || '' : existing.instagram,
    telegram: updates.telegram !== undefined ? updates.telegram || '' : existing.telegram,
  };

  const conn = await db.getConnection();

  try {
    await conn.query(
      'CALL sp_update_application(?, ?, ?, ?, ?, ?, ?, @p_result_code)',
      [normalizedPhone, merged.name, merged.email, merged.playerMobileId, merged.facebook, merged.instagram, merged.telegram]
    );

    const [[outParams]] = await conn.query('SELECT @p_result_code AS result_code');

    if (outParams.result_code !== 'OK') {
      return { success: false, code: outParams.result_code, application: existing };
    }

    const application = await getApplication(normalizedPhone);
    return { success: true, application };
  } finally {
    conn.release();
  }
}

async function decideApplication(phone, decision, reviewer) {
  const normalizedPhone = normalizePhone(phone);
  const conn = await db.getConnection();

  try {
    await conn.query(
      'CALL sp_decide_application(?, ?, ?, @p_result_code)',
      [normalizedPhone, decision, reviewer || 'Supervisor']
    );

    const [[outParams]] = await conn.query('SELECT @p_result_code AS result_code');

    if (outParams.result_code !== 'OK') {
      const application = await getApplication(normalizedPhone);
      return { success: false, code: outParams.result_code, application };
    }

    const application = await getApplication(normalizedPhone);
    return { success: true, application };
  } finally {
    conn.release();
  }
}

async function resetSignupState() {
  await db.query('DELETE FROM signup_sessions');
  await db.query('DELETE FROM customers');
  await db.query('DELETE FROM applications');
}

module.exports = {
  normalizePhone,
  createSignupSession,
  verifySignupOtp,
  getApplication,
  listApplications,
  updateApplication,
  decideApplication,
  getRegisteredPhones,
  loginCustomer,
  resetSignupState,
};
