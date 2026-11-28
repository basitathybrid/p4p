const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'support-chat-test-secret';
const db = require('./db');
const { app } = require('./index');
const { signCustomerToken, signSupervisorToken, signBasicUserToken } = require('./auth');
const { validateFile, deleteExpiredMessages } = require('./supportChat');

test('support chat isolates customers, prevents staff initiation and streams updates', async () => {
  const query = db.query;
  const execute = db.execute;
  const calls = [];
  db.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('is_active = 1')) return [params[0] === 99 ? [] : [{ id: params[0] }]];
    if (sql.includes('FROM applications WHERE')) return [[{ phone: params[0] }]];
    if (sql.includes('SELECT id FROM support_messages')) return [params[0] === 'new-customer' ? [] : [{ id: 1 }]];
    if (sql.includes('attachment_data FROM support_messages')) return [[]];
    if (sql.includes('FROM support_messages WHERE customer_phone')) return [[{
      id: 1, senderRole: 'customer', senderName: 'Customer', body: 'Hello', createdAt: new Date(),
    }]];
    if (sql.includes('JOIN applications')) return [[]];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  db.execute = async (sql, params) => { calls.push({ sql, params }); return [{ insertId: 2 }]; };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/support`;
  const customer = signCustomerToken('customer-one');
  const other = signCustomerToken('customer-two');
  const supervisor = signSupervisorToken({ id: 1, name: 'Supervisor' });
  const basic = signBasicUserToken({ id: 2, name: 'Basic' });
  const headers = (token) => ({ Authorization: `Bearer ${token}` });
  const controllers = [];
  try {
    assert.equal((await fetch(`${base}/conversations`)).status, 401);
    assert.equal((await fetch(`${base}/conversations`, { headers: headers(customer) })).status, 403);
    assert.equal((await fetch(`${base}/conversations`, { headers: headers(signBasicUserToken({ id: 99 })) })).status, 403);
    for (const token of [supervisor, basic]) {
      assert.equal((await fetch(`${base}/conversations`, { headers: headers(token) })).status, 200);
      assert.equal((await fetch(`${base}/conversations/new-customer/messages`, {
        method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hello' }),
      })).status, 404);
    }
    assert.equal((await fetch(`${base}/conversations/customer-two/messages`, { headers: headers(customer) })).status, 200);
    const historyQuery = calls.find((call) => call.sql.includes('sender_role AS senderRole'));
    assert.equal(historyQuery.params[0], 'customer-one');
    assert.match(historyQuery.sql, /INTERVAL 30 DAY/);
    assert.equal((await fetch(`${base}/conversations/customer-two/attachments/1`, { headers: headers(customer) })).status, 404);
    assert.equal(calls.find((call) => call.sql.includes('attachment_data FROM support_messages')).params[1], 'customer-one');

    const streams = [];
    for (const token of [customer, other, basic]) {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(`${base}/events`, { headers: headers(token), signal: controller.signal });
      const reader = response.body.getReader();
      await reader.read();
      streams.push(reader);
    }
    const send = await fetch(`${base}/conversations/me/messages`, {
      method: 'POST', headers: { ...headers(customer), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hello' }),
    });
    assert.equal(send.status, 201);
    assert.equal(calls.find((call) => call.sql.includes('INSERT INTO support_messages')).params[0], 'customer-one');
    for (const reader of [streams[0], streams[2]]) {
      const result = await reader.read();
      assert.match(Buffer.from(result.value).toString(), /event: change/);
    }
    const otherResult = await Promise.race([streams[1].read().then(() => 'received'), new Promise((resolve) => setTimeout(() => resolve('no event'), 100))]);
    assert.equal(otherResult, 'no event');
    assert.equal((await fetch(`${base}/conversations/me/attachments`, {
      method: 'POST', headers: { ...headers(customer), 'Content-Type': 'application/pdf', 'X-File-Name': 'test.pdf' }, body: 'not a pdf',
    })).status, 400);
    assert.equal((await fetch(`${base}/conversations/me/attachments`, {
      method: 'POST', headers: { ...headers(customer), 'Content-Type': 'application/pdf', 'X-File-Name': 'test.pdf' }, body: '%PDF-1.7\n',
    })).status, 201);
    assert.equal((await fetch(`${base}/conversations/me/messages`, {
      method: 'POST', headers: { ...headers(customer), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: ' '.repeat(5) }),
    })).status, 400);
  } finally {
    controllers.forEach((controller) => controller.abort());
    db.query = query;
    db.execute = execute;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('support attachment limits and signatures are enforced', () => {
  assert.equal(validateFile('application/pdf', Buffer.from('%PDF-1.7')), null);
  assert.equal(validateFile('image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), null);
  assert.match(validateFile('image/png', Buffer.from('fake')), /does not match/);
  assert.match(validateFile('text/html', Buffer.from('hello')), /Only/);
  assert.match(validateFile('application/pdf', Buffer.alloc(50 * 1024 * 1024 + 1)), /50 MB/);
  assert.equal(validateFile('application/pdf', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(50 * 1024 * 1024 - 5)])), null);
});

test('retention deletes old messages in batches and propagates errors', async () => {
  const query = db.query;
  let count = 0;
  db.query = async (sql) => {
    assert.match(sql, /created_at < DATE_SUB\(NOW\(\), INTERVAL 30 DAY\) LIMIT 500/);
    return [{ affectedRows: count++ === 0 ? 500 : 1 }];
  };
  try {
    await deleteExpiredMessages();
    assert.equal(count, 2);
    db.query = async () => { throw new Error('database unavailable'); };
    await assert.rejects(deleteExpiredMessages(), /database unavailable/);
  } finally { db.query = query; }
});
