const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'account-settings-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signCustomerToken, signSupervisorToken } = require('./auth');

test('customers and supervisors can update their own account names and emails', async () => {
  const originalQuery = db.query;
  const originalGetConnection = db.getConnection;
  const application = {
    profile_id: 'profile-1',
    phone: '19195550147',
    name: 'Ava Johnson',
    email: 'ava@example.com',
    status: 'approved',
  };
  const supervisor = {
    id: 7,
    full_name: 'Maria Rodriguez',
    username: 'maria.rodriguez',
    email: 'supervisor@example.com',
    role: 'supervisor',
    profile_image_key: null,
  };
  let customerPasswordHash = await bcrypt.hash('customer-current-password', 4);
  let supervisorPasswordHash = await bcrypt.hash('supervisor-current-password', 4);

  db.query = async (sql, params = []) => {
    if (sql.includes('SELECT * FROM applications WHERE phone = ?')) return [[application]];
    if (sql.includes('UPDATE applications SET name = ?, email = ? WHERE phone = ?')) {
      [application.name, application.email] = params;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT id FROM supervisors WHERE LOWER(email)')) {
      return params[0] === 'in-use@example.com' ? [[{ id: 8 }]] : [[]];
    }
    if (sql.includes('UPDATE supervisors SET full_name = ?, email = ?')) {
      [supervisor.full_name, supervisor.email] = params;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT password_hash FROM customers WHERE phone = ?')) return [[{ password_hash: customerPasswordHash }]];
    if (sql.includes('UPDATE customers SET password_hash = ? WHERE phone = ?')) {
      customerPasswordHash = params[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT password_hash FROM supervisors WHERE id = ?')) return [[{ password_hash: supervisorPasswordHash }]];
    if (sql.includes('UPDATE supervisors SET password_hash = ? WHERE id = ?')) {
      supervisorPasswordHash = params[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM supervisors') && sql.includes('WHERE id = ?')) return [[supervisor]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  db.getConnection = async () => {
    throw new Error('Customer profile settings should not require an application-edit transaction.');
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const customerToken = signCustomerToken('+19195550147');
  const supervisorToken = signSupervisorToken({ id: 7, name: supervisor.full_name, email: supervisor.email });

  try {
    const customerResponse = await fetch(`${base}/customer/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ name: 'Ava Updated', email: 'ava.updated@example.com' }),
    });
    const customerBody = await customerResponse.json();
    assert.equal(customerResponse.status, 200, JSON.stringify(customerBody));
    assert.equal(customerBody.profile.name, 'Ava Updated');
    assert.equal(customerBody.profile.email, 'ava.updated@example.com');

    const customerProfileResponse = await fetch(`${base}/customer/profile`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const customerProfileBody = await customerProfileResponse.json();
    assert.equal(customerProfileResponse.status, 200);
    assert.equal(customerProfileBody.profile.email, 'ava.updated@example.com');
    assert.equal(customerProfileBody.profile.name, 'Ava Updated');

    const supervisorResponse = await fetch(`${base}/supervisor/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ name: 'Maria Updated', email: 'maria.updated@example.com' }),
    });
    const supervisorBody = await supervisorResponse.json();
    assert.equal(supervisorResponse.status, 200);
    assert.equal(supervisorBody.profile.name, 'Maria Updated');
    assert.equal(supervisorBody.profile.email, 'maria.updated@example.com');

    const duplicateEmailResponse = await fetch(`${base}/supervisor/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ name: 'Maria Updated', email: 'in-use@example.com' }),
    });
    assert.equal(duplicateEmailResponse.status, 409);

    const invalidEmailResponse = await fetch(`${base}/customer/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ name: 'Ava Updated', email: 'not-an-email' }),
    });
    assert.equal(invalidEmailResponse.status, 400);

    const customerPasswordResponse = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ oldPassword: 'customer-current-password', newPassword: 'customer-new-password' }),
    });
    assert.equal(customerPasswordResponse.status, 200);
    assert.equal(await bcrypt.compare('customer-new-password', customerPasswordHash), true);

    const supervisorPasswordResponse = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ oldPassword: 'supervisor-current-password', newPassword: 'supervisor-new-password' }),
    });
    assert.equal(supervisorPasswordResponse.status, 200);
    assert.equal(await bcrypt.compare('supervisor-new-password', supervisorPasswordHash), true);
  } finally {
    db.query = originalQuery;
    db.getConnection = originalGetConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});
