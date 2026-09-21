const db = require('./db');
const { DEFAULT_THRESHOLDS, getTierThresholds, tierForVolume: calculateTier } = require('./tierService');

const TRANSACTION_TYPES = new Set(['buy', 'send', 'receive', 'sell']);
const REQUIRED_HEADERS = [
  ['no', 'NO'],
  ['mobileno', 'MOBILE_NO'],
  ['transactionid', 'TRANSACTION_ID'],
  ['transactiontype', 'TRANSACTION_TYPE'],
  ['transactiondatetime', 'TRANSACTION_DATETIME'],
  ['amount', 'AMOUNT'],
  ['status', 'STATUS'],
];

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseAmount(value) {
  const normalized = String(value || '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

function parseTransactionDate(value) {
  const date = new Date(String(value || '').trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function tierForVolume(volume) {
  return calculateTier(volume, DEFAULT_THRESHOLDS);
}

function mapRow(headers, values, rowNumber) {
  const row = Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()]));
  const transactionType = row.transactiontype.toLowerCase();
  const amount = parseAmount(row.amount);
  const transactionDate = parseTransactionDate(row.transactiondatetime);

  if (!row.mobileno || !row.transactionid || !TRANSACTION_TYPES.has(transactionType) || amount === null || !transactionDate || !row.status) {
    return { rowNumber, error: 'Missing or invalid required field.' };
  }

  return {
    rowNumber,
    phone: row.mobileno,
    transactionId: row.transactionid,
    transactionType,
    transactionDate,
    amount,
    status: row.status,
  };
}

async function importTransactions(csv) {
  if (typeof csv !== 'string' || !csv.trim()) {
    return { success: false, code: 'EMPTY_FILE', message: 'A CSV file is required.' };
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return { success: false, code: 'INVALID_CSV', message: 'The CSV must include a header and at least one data row.' };
  }

  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = REQUIRED_HEADERS.map(([header]) => header);
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    const missingHeaderLabels = missingHeaders.map((header) => REQUIRED_HEADERS.find(([name]) => name === header)[1]);
    return {
      success: false,
      code: 'INVALID_HEADERS',
      message: `Missing required column${missingHeaderLabels.length === 1 ? '' : 's'}: ${missingHeaderLabels.join(', ')}.`,
      missingHeaders,
      missingHeaderLabels,
      receivedHeaders: rows[0].map((header) => String(header || '').trim()).filter(Boolean),
      expectedHeaders: REQUIRED_HEADERS.map(([, label]) => label),
    };
  }

  const parsedRows = rows.slice(1).map((values, index) => mapRow(headers, values, index + 2));
  const report = { imported: [], duplicates: [], unmatched: [], invalid: [] };
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const thresholds = await getTierThresholds(conn);
    const [approvedRows] = await conn.query("SELECT phone FROM applications WHERE status = 'approved'");
    const approvedPhones = new Set(approvedRows.map((row) => row.phone));

    for (const row of parsedRows) {
      if (row.error) {
        report.invalid.push({ row: row.rowNumber, reason: row.error });
        continue;
      }

      const normalizedPhone = normalizePhone(row.phone);
      if (!approvedPhones.has(normalizedPhone)) {
        report.unmatched.push({ row: row.rowNumber, transactionId: row.transactionId, phone: row.phone });
        continue;
      }

      const [existing] = await conn.query('SELECT transaction_id FROM transactions WHERE transaction_id = ? LIMIT 1', [row.transactionId]);
      if (existing[0]) {
        report.duplicates.push({ row: row.rowNumber, transactionId: row.transactionId });
        continue;
      }

      await conn.query(
        `INSERT INTO transactions
          (transaction_id, phone, transaction_type, transaction_datetime, transaction_amount, transaction_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.transactionId, normalizedPhone, row.transactionType, row.transactionDate, row.amount, row.status]
      );
      report.imported.push({ row: row.rowNumber, transactionId: row.transactionId, phone: normalizedPhone });
    }

    const importedPhones = [...new Set(report.imported.map((row) => row.phone))];
    for (const phone of importedPhones) {
      await conn.query(
        `INSERT INTO customer_usage (phone, lifetime_transaction_volume, transaction_count, last_activity_at, buy_total, send_total, receive_total, sell_total, reward_tier)
         SELECT phone,
           COALESCE(SUM(transaction_amount), 0), COUNT(*), MAX(transaction_datetime),
           COALESCE(SUM(CASE WHEN transaction_type = 'buy' THEN transaction_amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN transaction_type = 'send' THEN transaction_amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN transaction_type = 'receive' THEN transaction_amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN transaction_type = 'sell' THEN transaction_amount ELSE 0 END), 0),
           'Bronze'
         FROM transactions WHERE phone = ?
         ON DUPLICATE KEY UPDATE
           lifetime_transaction_volume = VALUES(lifetime_transaction_volume),
           transaction_count = VALUES(transaction_count), last_activity_at = VALUES(last_activity_at),
           buy_total = VALUES(buy_total), send_total = VALUES(send_total),
           receive_total = VALUES(receive_total), sell_total = VALUES(sell_total)`,
        [phone]
      );

      const [usageRows] = await conn.query(
        'SELECT lifetime_transaction_volume, tier_override FROM customer_usage WHERE phone = ?',
        [phone]
      );
      if (usageRows[0] && !usageRows[0].tier_override) {
        await conn.query(
          'UPDATE customer_usage SET reward_tier = ? WHERE phone = ?',
          [calculateTier(usageRows[0].lifetime_transaction_volume, thresholds), phone]
        );
      }
    }

    await conn.commit();
    return { success: true, ...report, totals: { imported: report.imported.length, duplicates: report.duplicates.length, unmatched: report.unmatched.length, invalid: report.invalid.length } };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `1${digits}` : digits;
}

module.exports = { importTransactions, parseCsv, tierForVolume };