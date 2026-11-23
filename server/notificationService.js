const db = require('./db');
const crypto = require('crypto');

const SUPPORTED_ROLES = new Set(['customer', 'supervisor', 'basic']);

function normalizeRecipient(role, id) {
  const recipientRole = String(role || '').trim().toLowerCase();
  const recipientId = String(id ?? '').trim();

  if (!SUPPORTED_ROLES.has(recipientRole) || !recipientId) {
    return null;
  }

  return { recipientRole, recipientId };
}

function mapNotification(row) {
  let metadata = null;
  if (row.metadata) {
    try {
      metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    } catch (error) {
      console.error('Unable to parse notification metadata:', error);
    }
  }

  if (metadata?.kind === 'signup') {
    const status = metadata.superseded ? 'superseded' : row.application_status || 'unavailable';
    metadata = { ...metadata, approvalStatus: status };
  }

  return {
    id: Number(row.id),
    title: row.title,
    message: row.message,
    type: row.notification_type,
    eventKey: row.event_key,
    actionUrl: row.action_url,
    metadata,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function notifySupervisors({ connection = db, title, message, eventKey, actionUrl, metadata }) {
  await connection.query(
    `INSERT INTO notifications
       (recipient_role, recipient_id, title, message, notification_type, event_key, action_url, metadata)
     SELECT 'supervisor', CAST(id AS CHAR), ?, ?, 'info', ?, ?, ?
     FROM supervisors WHERE is_active = 1`,
    [title, message, eventKey, actionUrl, JSON.stringify(metadata)],
  );
}

async function notifySignupPending(connection, phone) {
  await connection.query(
    `UPDATE notifications SET metadata = JSON_SET(metadata, '$.superseded', true)
     WHERE recipient_role = 'supervisor'
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.kind')) = 'signup'
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.phone')) = ?`,
    [phone],
  );
  await notifySupervisors({
    connection,
    title: 'New player sign-up',
    message: 'New player sign-up is pending approval.',
    eventKey: `signup:${phone}:${crypto.randomUUID()}`,
    actionUrl: `/supervisor?application=${encodeURIComponent(phone)}#pending-applications`,
    metadata: { kind: 'signup', phone, actionLabel: 'Open pending sign-ups' },
  });
}

async function notifyMissionChange(connection, actor, mission, change) {
  const actorName = String(actor.name || actor.username || 'Supervisor').trim();
  await notifySupervisors({
    connection,
    title: 'Daily Mission settings updated',
    message: `Daily Mission: ${mission.title} (${change}) by ${actorName}.`,
    eventKey: `mission-settings:${crypto.randomUUID()}`,
    actionUrl: '/supervisor/missions',
    metadata: { kind: 'mission_settings', section: 'Daily Mission', actor: actorName, missionId: mission.id, actionLabel: 'View updated settings' },
  });
}

async function createNotification({
  recipientRole,
  recipientId,
  title,
  message,
  type = 'info',
  eventKey = null,
  actionUrl = null,
  metadata = null,
  connection = db,
}) {
  const recipient = normalizeRecipient(recipientRole, recipientId);
  const normalizedTitle = String(title || '').trim();
  const normalizedMessage = String(message || '').trim();

  if (!recipient || !normalizedTitle || !normalizedMessage) {
    throw new Error('Notification recipient, title, and message are required.');
  }

  const [result] = await connection.query(
    `INSERT INTO notifications
      (recipient_role, recipient_id, title, message, notification_type, event_key, action_url, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      recipient.recipientRole,
      recipient.recipientId,
      normalizedTitle,
      normalizedMessage,
      String(type || 'info').trim().slice(0, 32) || 'info',
      eventKey ? String(eventKey).slice(0, 128) : null,
      actionUrl ? String(actionUrl).slice(0, 512) : null,
      metadata == null ? null : JSON.stringify(metadata),
    ],
  );

  const [rows] = await connection.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
  return mapNotification(rows[0]);
}

async function createTierChangeNotification({
  connection = db,
  phone,
  previousTier,
  newTier,
  effectiveDate = new Date().toISOString().slice(0, 10),
}) {
  if (!previousTier || !newTier || previousTier === newTier) return null;

  const upgraded = Number({ Bronze: 0, Silver: 1, Gold: 2, Diamond: 3 }[newTier])
    > Number({ Bronze: 0, Silver: 1, Gold: 2, Diamond: 3 }[previousTier]);
  const dateLabel = new Date(`${effectiveDate}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return createNotification({
    connection,
    recipientRole: 'customer',
    recipientId: phone,
    title: upgraded ? 'Tier upgraded' : 'Tier changed',
    message: upgraded
      ? `Your tier has been upgraded to ${newTier}. Congratulations!`
      : `Your tier has changed to ${newTier}. View your current tier details.`,
    type: upgraded ? 'success' : 'info',
    eventKey: `tier-change:${phone}:${previousTier}:${newTier}:${effectiveDate}`,
    actionUrl: '/customer',
    metadata: {
      previousTier,
      newTier,
      effectiveDate,
      effectiveDateLabel: dateLabel,
      actionLabel: upgraded ? 'View tier benefits' : 'View tier details',
    },
  });
}

async function listNotifications(role, id, { limit = 30, unreadOnly = false } = {}) {
  const recipient = normalizeRecipient(role, id);
  if (!recipient) throw new Error('Valid notification recipient is required.');

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const supervisor = recipient.recipientRole === 'supervisor';
  const pendingSignup = `a.status = 'pending_review'
       AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.superseded')), 'false') <> 'true'`;
  const recentFilter = supervisor
    ? ` AND ((${pendingSignup}) OR n.id IN (
        SELECT recent.id FROM (
          SELECT id FROM notifications WHERE recipient_role = ? AND recipient_id = ?${unreadOnly ? ' AND read_at IS NULL' : ''}
          ORDER BY created_at DESC, id DESC LIMIT ?
        ) recent
      ))`
    : '';
  const [rows] = await db.query(
    `SELECT n.id, n.title, n.message, n.notification_type, n.event_key, n.action_url, n.metadata, n.read_at, n.created_at
     ${supervisor ? ', a.status AS application_status' : ''}
     FROM notifications n
     ${supervisor ? `LEFT JOIN applications a ON JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.kind')) = 'signup'
       AND a.phone = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.phone'))` : ''}
     WHERE n.recipient_role = ? AND n.recipient_id = ?${unreadOnly ? ' AND n.read_at IS NULL' : ''}${recentFilter}
     ORDER BY ${supervisor ? `(CASE WHEN ${pendingSignup} THEN 0 ELSE 1 END), ` : ''}n.created_at DESC, n.id DESC
     ${supervisor ? '' : 'LIMIT ?'}`,
    supervisor
      ? [recipient.recipientRole, recipient.recipientId, recipient.recipientRole, recipient.recipientId, safeLimit]
      : [recipient.recipientRole, recipient.recipientId, safeLimit],
  );
  return rows.map(mapNotification);
}

async function getUnreadCount(role, id) {
  const recipient = normalizeRecipient(role, id);
  if (!recipient) throw new Error('Valid notification recipient is required.');

  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM notifications
     WHERE recipient_role = ? AND recipient_id = ? AND read_at IS NULL`,
    [recipient.recipientRole, recipient.recipientId],
  );
  return Number(rows[0].count);
}

async function markNotificationRead(id, role, recipientId) {
  const recipient = normalizeRecipient(role, recipientId);
  if (!recipient) throw new Error('Valid notification recipient is required.');

  const [result] = await db.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = ? AND recipient_role = ? AND recipient_id = ?`,
    [id, recipient.recipientRole, recipient.recipientId],
  );
  return result.affectedRows > 0;
}

async function markAllNotificationsRead(role, recipientId) {
  const recipient = normalizeRecipient(role, recipientId);
  if (!recipient) throw new Error('Valid notification recipient is required.');

  const [result] = await db.query(
    `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
     WHERE recipient_role = ? AND recipient_id = ? AND read_at IS NULL`,
    [recipient.recipientRole, recipient.recipientId],
  );
  return result.affectedRows;
}

function recipientFromUser(user) {
  if (!user?.role) return null;
  return normalizeRecipient(user.role, user.role === 'customer' ? user.phone : user.id);
}

module.exports = {
  createNotification,
  notifySignupPending,
  notifyMissionChange,
  createTierChangeNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  recipientFromUser,
};
