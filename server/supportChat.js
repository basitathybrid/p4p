const express = require('express');
const { EventEmitter } = require('events');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
const events = new EventEmitter();
events.setMaxListeners(0);
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const retentionFilter = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
const staffRoles = new Set(['supervisor', 'basic']);

function isStaff(user) {
  return staffRoles.has(user.role);
}

function validateFile(type, data) {
  if (!Buffer.isBuffer(data) || !data.length) return 'Choose a file to upload.';
  if (data.length > MAX_ATTACHMENT_BYTES) return 'Attachments must be 50 MB or smaller.';
  const valid = {
    'image/jpeg': () => data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255,
    'image/png': () => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/gif': () => data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6)),
    'image/webp': () => data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP',
    'application/pdf': () => data.subarray(0, 5).toString('ascii') === '%PDF-',
  };
  if (!valid[type]) return 'Only JPEG, PNG, GIF, WebP and PDF files are supported.';
  if (!valid[type]()) return 'The file does not match its declared type.';
  return null;
}

async function customerExists(phone) {
  const [rows] = await db.query("SELECT phone FROM applications WHERE phone = ? AND status = 'approved'", [phone]);
  return Boolean(rows[0]);
}

async function authorizeConversation(req, res, next) {
  const phone = req.user.role === 'customer' ? req.user.phone : req.params.phone;
  if (!phone || (!isStaff(req.user) && req.user.role !== 'customer')) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  try {
    if (!(await customerExists(phone))) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (isStaff(req.user)) {
      const [rows] = await db.query(`SELECT id FROM support_messages WHERE customer_phone = ? AND ${retentionFilter} LIMIT 1`, [phone]);
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    req.chatPhone = phone;
    return next();
  } catch (error) {
    console.error('support conversation authorization failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to access conversation.' });
  }
}

router.use(requireAuth());
router.use(async (req, res, next) => {
  if (req.user.role === 'customer') return next();
  if (!isStaff(req.user)) return res.status(403).json({ success: false, message: 'Access denied.' });
  const table = req.user.role === 'supervisor' ? 'supervisors' : 'basic_users';
  try {
    const [rows] = await db.query(`SELECT id FROM ${table} WHERE id = ? AND is_active = 1`, [req.user.id]);
    if (!rows[0]) return res.status(403).json({ success: false, message: 'Access denied for this account.' });
    return next();
  } catch (error) {
    console.error('support account authorization failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify account access.' });
  }
});

router.get('/events', (req, res) => {
  if (!isStaff(req.user) && req.user.role !== 'customer') return res.status(403).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');
  const onMessage = (phone) => {
    if (isStaff(req.user) || phone === req.user.phone) res.write('event: change\ndata: {}\n\n');
  };
  events.on('message', onMessage);
  const heartbeat = setInterval(() => {
    if (req.user.exp && Date.now() >= req.user.exp * 1000) return res.end();
    res.write(': heartbeat\n\n');
  }, 15000);
  req.on('close', () => { clearInterval(heartbeat); events.off('message', onMessage); });
});

router.get('/conversations', async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ success: false, message: 'Access denied.' });
  const before = Number(req.query.before || Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(before) || before < 1) return res.status(400).json({ success: false, message: 'Invalid cursor.' });
  try {
    const [rows] = await db.query(
      `SELECT m.customer_phone AS phone, a.name, m.id AS lastMessageId, m.created_at AS lastMessageAt
       FROM support_messages m JOIN applications a ON a.phone = m.customer_phone
       JOIN (SELECT customer_phone, MAX(id) AS last_id FROM support_messages
             WHERE ${retentionFilter} GROUP BY customer_phone) latest ON latest.last_id = m.id
       WHERE m.id < ? AND a.status = 'approved' ORDER BY m.id DESC LIMIT 51`, [before],
    );
    return res.json({ success: true, conversations: rows.slice(0, 50), hasMore: rows.length > 50 });
  } catch (error) {
    console.error('support inbox failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load conversations.' });
  }
});

router.get('/conversations/:phone/messages', authorizeConversation, async (req, res) => {
  const before = Number(req.query.before || Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(before) || before < 1) return res.status(400).json({ success: false, message: 'Invalid cursor.' });
  try {
    const [rows] = await db.query(
      `SELECT id, sender_role AS senderRole, sender_name AS senderName, body,
              attachment_name AS attachmentName, attachment_type AS attachmentType, created_at AS createdAt
       FROM support_messages WHERE customer_phone = ? AND ${retentionFilter} AND id < ?
       ORDER BY id DESC LIMIT 51`, [req.chatPhone, before],
    );
    return res.json({ success: true, messages: rows.slice(0, 50).reverse(), hasMore: rows.length > 50 });
  } catch (error) {
    console.error('load support messages failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load messages.' });
  }
});

async function insertMessage(req, res, body, name, type, data) {
  const senderName = req.user.role === 'customer' ? 'Customer' : String(req.user.name || req.user.username || 'Staff').slice(0, 255);
  try {
    await db.execute(
      `INSERT INTO support_messages (customer_phone, sender_role, sender_name, body, attachment_name, attachment_type, attachment_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.chatPhone, req.user.role, senderName, body, name, type, data],
    );
    events.emit('message', req.chatPhone);
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('send support message failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send message.' });
  }
}

router.post('/conversations/:phone/messages', authorizeConversation, express.json(), async (req, res) => {
  const body = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!body || body.length > 4000) return res.status(400).json({ success: false, message: 'Message must contain 1 to 4000 characters.' });
  return insertMessage(req, res, body, null, null, null);
});

router.post('/conversations/:phone/attachments', authorizeConversation,
  express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES }),
  async (req, res) => {
    const type = String(req.header('content-type') || '').toLowerCase().split(';')[0];
    const error = validateFile(type, req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    let name;
    try { name = decodeURIComponent(String(req.header('x-file-name') || 'attachment')); } catch {
      return res.status(400).json({ success: false, message: 'Invalid file name.' });
    }
    name = name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'attachment';
    return insertMessage(req, res, null, name, type, req.body);
  },
);

router.get('/conversations/:phone/attachments/:id', authorizeConversation, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid attachment.' });
  try {
    const [rows] = await db.query(
      `SELECT attachment_name, attachment_type, attachment_data FROM support_messages
       WHERE id = ? AND customer_phone = ? AND ${retentionFilter} AND attachment_data IS NOT NULL`, [id, req.chatPhone],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Attachment not found.' });
    res.set({ 'Content-Type': rows[0].attachment_type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].attachment_name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    return res.send(rows[0].attachment_data);
  } catch (error) {
    console.error('download support attachment failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to download attachment.' });
  }
});

router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Attachments must be 50 MB or smaller.' });
  }
  return next(error);
});

async function deleteExpiredMessages() {
  let affectedRows;
  do {
    [ { affectedRows } ] = await db.query('DELETE FROM support_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 500');
  } while (affectedRows === 500);
}

function startChatRetention() {
  let running = false;
  const clean = async () => {
    if (running) return;
    running = true;
    try {
      await deleteExpiredMessages();
    } catch (error) {
      console.error('support chat retention failed:', error);
    } finally {
      running = false;
    }
  };
  clean();
  const timer = setInterval(clean, 60 * 60 * 1000);
  timer.unref();
}

module.exports = { router, startChatRetention, deleteExpiredMessages, validateFile };
