const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'profile-picture-test-secret';
process.env.PROFILE_IMAGE_STORAGE_DIR = path.join(os.tmpdir(), `p4p-picture-routes-${process.pid}`);

const accounts = {
  customers: new Map([['+19195550147', null], ['+17045550189', null]]),
  basic_users: new Map([[12, null], [13, null]]),
  supervisors: new Map([[7, null], [8, null]]),
};

const db = require('./db');
db.query = async (sql, params) => {
  const table = ['customers', 'basic_users', 'supervisors'].find((name) => sql.includes(`FROM ${name}`) || sql.includes(`UPDATE ${name}`));
  if (!table) throw new Error(`Unexpected query: ${sql}`);
  const entries = accounts[table];
  if (sql.startsWith('SELECT')) {
    const id = params[0];
    if (!entries.has(id)) return [[]];
    return [[table === 'supervisors'
      ? { id, full_name: 'Supervisor', username: 'supervisor', email: 'supervisor@example.com', role: 'supervisor', profile_image_key: entries.get(id) }
      : { profile_image_key: entries.get(id) }]];
  }
  const [key, id] = params;
  if (!entries.has(id)) return [{ affectedRows: 0 }];
  entries.set(id, key);
  return [{ affectedRows: 1 }];
};

const { app } = require('./index');
const { signCustomerToken, signBasicUserToken, signSupervisorToken } = require('./auth');

test('pictures persist per authenticated customer and staff account', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const customerToken = signCustomerToken('+19195550147');
  const otherCustomerToken = signCustomerToken('+17045550189');
  const basicToken = signBasicUserToken({ id: 12 });
  const otherBasicToken = signBasicUserToken({ id: 13 });
  const supervisorToken = signSupervisorToken({ id: 7 });
  const otherSupervisorToken = signSupervisorToken({ id: 8 });
  const image = Buffer.from('89504e470d0a1a0a', 'hex');

  const request = (route, token, options = {}) => fetch(`${base}/api/${route}/profile-picture`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });

  try {
    assert.equal((await fetch(`${base}/api/customer/profile-picture`)).status, 401);
    assert.equal((await request('customer', basicToken)).status, 403);
    assert.equal((await request('customer', customerToken)).status, 404);

    for (const [route, token] of [['customer', customerToken], ['basic', basicToken], ['supervisor', supervisorToken]]) {
      const upload = await request(route, token, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image });
      assert.equal(upload.status, 200, `${route}: ${await upload.text()}`);
      const download = await request(route, token);
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), image);
    }

    assert.equal((await request('customer', otherCustomerToken)).status, 404);
    assert.equal((await request('basic', otherBasicToken)).status, 404);
    assert.equal((await request('supervisor', otherSupervisorToken)).status, 404);
    assert.equal((await request('basic', customerToken)).status, 403);
    const invalid = await request('customer', customerToken, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: 'not a png' });
    assert.equal(invalid.status, 400);
    assert.equal((await request('customer', customerToken)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(process.env.PROFILE_IMAGE_STORAGE_DIR, { recursive: true, force: true });
  }
});