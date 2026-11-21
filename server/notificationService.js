const db = require('./db');

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
  const [rows] = await db.query(
    `SELECT id, title, message, notification_type, event_key, action_url, metadata, read_at, created_at
     FROM notifications
     WHERE recipient_role = ? AND recipient_id = ?${unreadOnly ? ' AND read_at IS NULL' : ''}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [recipient.recipientRole, recipient.recipientId, safeLimit],
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
  createTierChangeNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  recipientFromUser,
};
