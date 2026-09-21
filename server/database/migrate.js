const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATIONS = [
  {
    id: '000_schema_bootstrap',
    async up(conn) {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await conn.query(schema);
    },
  },
  {
    id: '001_tier_configuration_and_overrides',
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS tier_thresholds (
          tier_name ENUM('Bronze', 'Silver', 'Gold', 'Diamond') PRIMARY KEY,
          minimum_volume DECIMAL(18, 2) NOT NULL
        )
      `);
      await conn.query(`
        INSERT INTO tier_thresholds (tier_name, minimum_volume) VALUES
          ('Bronze', 0), ('Silver', 5000), ('Gold', 10000), ('Diamond', 15000)
        ON DUPLICATE KEY UPDATE tier_name = tier_name
      `);

      const [columns] = await conn.query(
        `SELECT COUNT(*) AS count FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'customer_usage' AND column_name = 'tier_override'`
      );
      if (!columns[0].count) {
        await conn.query("ALTER TABLE customer_usage ADD COLUMN tier_override ENUM('Bronze', 'Silver', 'Gold', 'Diamond') NULL AFTER reward_tier");
      }
    },
  },
];

async function migrateDatabase() {
  const conn = await db.getConnection();
  const lockName = `${process.env.DB_NAME || 'p4p'}:p4p:migrations`;

  try {
    const [lockRows] = await conn.query('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
    if (!lockRows[0]?.acquired) throw new Error('Could not acquire database migration lock.');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(150) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of MIGRATIONS) {
      const [appliedRows] = await conn.query('SELECT id FROM schema_migrations WHERE id = ?', [migration.id]);
      if (appliedRows[0]) continue;

      await migration.up(conn);
      await conn.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
      console.log(`Applied database migration: ${migration.id}`);
    }
  } finally {
    try {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
      conn.release();
    }
  }
}

module.exports = { migrateDatabase };

if (require.main === module) {
  migrateDatabase()
    .then(() => console.log('Database migrations are up to date.'))
    .catch((error) => {
      console.error('Database migration failed.', error);
      process.exitCode = 1;
    });
}