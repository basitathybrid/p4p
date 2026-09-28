const crypto = require('crypto');
const db = require('./db');

async function writeAuditLog(actor, action, targetType, targetId = null, details = {}, executor = db, eventKey = null) {
  const actorId = Number.isSafeInteger(Number(actor?.id)) ? Number(actor.id) : null;
  const actorName = String(actor?.name || actor?.username || `Internal user ${actorId || ''}`).trim().slice(0, 255);
  const actorRole = String(actor?.role || 'internal').slice(0, 32);
  const connection = eventKey && executor === db ? await db.getConnection() : executor;
  const ownsConnection = connection !== executor;
  const lockName = eventKey
    ? `p4p_audit_${crypto.createHash('sha256').update(eventKey).digest('hex').slice(0, 48)}`
    : null;

  try {
    if (eventKey) {
      const [[lock]] = await connection.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
      if (Number(lock.acquired) !== 1) throw new Error('Could not acquire audit event lock.');

      const [existing] = await connection.query('SELECT id FROM audit_logs WHERE event_key = ? LIMIT 1', [eventKey]);
      if (existing[0]) return;
    }

    await connection.query(
      `INSERT INTO audit_logs
        (actor_id, actor_name, actor_role, action, target_type, target_id, details, event_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [actorId, actorName, actorRole, action, targetType, targetId == null ? null : String(targetId).slice(0, 255), JSON.stringify(details || {}), eventKey]
    );
  } finally {
    if (lockName) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    if (ownsConnection) connection.release();
  }
}

module.exports = { writeAuditLog };