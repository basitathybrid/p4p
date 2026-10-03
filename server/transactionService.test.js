const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('./db');
const { importTransactions } = require('./transactionService');

test('upload recalculates reward tier from the updated lifetime volume', async () => {
  const tierUpdates = [];
  const originalGetConnection = db.getConnection;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      if (sql.includes('FROM tier_thresholds')) {
        return [[
          { name: 'Bronze', minimum: 0 },
          { name: 'Silver', minimum: 5000 },
          { name: 'Gold', minimum: 10000 },
          { name: 'Diamond', minimum: 15000 },
        ]];
      }
      if (sql.includes("FROM applications WHERE status = 'approved'")) return [[{ phone: '19195550147' }]];
      if (sql.includes('SELECT transaction_id FROM transactions')) return [[]];
      if (sql.includes('INSERT INTO transactions')) return [{}];
      if (sql.includes('INSERT INTO customer_usage')) return [{}];
      if (sql.includes('SELECT lifetime_transaction_volume FROM customer_usage')) return [[{ lifetime_transaction_volume: 5600 }]];
      if (sql.includes('UPDATE customer_usage SET reward_tier')) {
        tierUpdates.push(params);
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  db.getConnection = async () => connection;
  try {
    const csv = [
      'NO,MOBILE_NO,TRANSACTION_ID,TRANSACTION_TYPE,TRANSACTION_DATETIME,AMOUNT,STATUS',
      '1,9195550147,send-completed,send,2026-09-27,5600,Completed',
    ].join('\n');

    const result = await importTransactions(csv);

    assert.equal(result.success, true);
    assert.equal(tierUpdates.length, 1);
    assert.deepEqual(tierUpdates[0], ['Silver', '19195550147']);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('lifetime volume includes only completed send transactions', async () => {
  const aggregateQueries = [];
  const auditEvents = [];
  const originalGetConnection = db.getConnection;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      if (sql.includes('FROM tier_thresholds')) {
        return [[
          { name: 'Bronze', minimum: 0 },
          { name: 'Silver', minimum: 5000 },
          { name: 'Gold', minimum: 10000 },
          { name: 'Diamond', minimum: 15000 },
        ]];
      }
      if (sql.includes("FROM applications WHERE status = 'approved'")) return [[{ phone: '19195550147' }]];
      if (sql.includes('SELECT transaction_id FROM transactions')) return [[]];
      if (sql.includes('INSERT INTO transactions')) return [{}];
      if (sql.includes('INSERT INTO customer_usage')) {
        aggregateQueries.push(sql);
        return [{}];
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditEvents.push({ sql, params });
        return [{}];
      }
      if (sql.includes('SELECT lifetime_transaction_volume FROM customer_usage')) return [[{ lifetime_transaction_volume: 0 }]];
      if (sql.includes('UPDATE customer_usage SET reward_tier')) return [{}];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  db.getConnection = async () => connection;
  try {
    const csv = [
      'NO,MOBILE_NO,TRANSACTION_ID,TRANSACTION_TYPE,TRANSACTION_DATETIME,AMOUNT,STATUS',
      '1,9195550147,send-completed,send,2026-09-27,10,Completed',
      '2,9195550147,send-pending,send,2026-09-27,20,Pending',
      '3,9195550147,buy-completed,buy,2026-09-27,30,Completed',
    ].join('\n');

    const result = await importTransactions(csv, { id: 9, name: 'Supervisor', role: 'supervisor' });

    assert.equal(result.success, true);
    assert.equal(aggregateQueries.length, 1);
    assert.match(aggregateQueries[0], /transaction_type = 'send' AND LOWER\(TRIM\(transaction_status\)\) = 'completed'/);
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].params[3], 'transaction_csv_uploaded');
    assert.deepEqual(JSON.parse(auditEvents[0].params[6]), {
      imported: 3, duplicates: 0, unmatched: 0, invalid: 0,
    });
  } finally {
    db.getConnection = originalGetConnection;
  }
});