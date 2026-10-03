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
  {
    id: '002_tier_override_supervisor_name',
    async up(conn) {
      const [columns] = await conn.query(
        `SELECT COUNT(*) AS count FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'customer_usage' AND column_name = 'tier_override_by'`
      );
      if (!columns[0].count) {
        await conn.query('ALTER TABLE customer_usage ADD COLUMN tier_override_by VARCHAR(255) NULL AFTER tier_override');
      }
    },
  },
  {
    id: '003_restore_automatic_tiers_for_overrides',
    async up(conn) {
      await conn.query(`
        UPDATE customer_usage usage_row
        SET reward_tier = COALESCE((
          SELECT tier_name FROM tier_thresholds
          WHERE minimum_volume <= usage_row.lifetime_transaction_volume
          ORDER BY minimum_volume DESC
          LIMIT 1
        ), 'Bronze')
      `);
    },
  },
  {
    id: '004_customer_and_basic_profile_images',
    async up(conn) {
      for (const table of ['customers', 'basic_users']) {
        const [columns] = await conn.query(
          `SELECT COUNT(*) AS count FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'profile_image_key'`,
          [table],
        );
        if (!columns[0].count) {
          await conn.query(`ALTER TABLE ${table} ADD COLUMN profile_image_key VARCHAR(512) NULL`);
        }
      }
    },
  },
  {
    id: '005_internal_audit_logs',
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          actor_id BIGINT UNSIGNED NULL,
          actor_name VARCHAR(255) NOT NULL,
          actor_role VARCHAR(32) NOT NULL,
          action VARCHAR(64) NOT NULL,
          target_type VARCHAR(64) NOT NULL,
          target_id VARCHAR(255) NULL,
          details JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_logs_created_at (created_at),
          INDEX idx_audit_logs_actor (actor_role, actor_id),
          INDEX idx_audit_logs_action (action),
          INDEX idx_audit_logs_target (target_type, target_id)
        )
      `);
    },
  },
  {
    id: '006_audit_view_event_idempotency',
    async up(conn) {
      const [columns] = await conn.query(
        `SELECT COUNT(*) AS count FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'audit_logs' AND column_name = 'event_key'`
      );
      if (!columns[0].count) {
        await conn.query('ALTER TABLE audit_logs ADD COLUMN event_key VARCHAR(64) NULL');
      }

      const [indexes] = await conn.query(
        `SELECT COUNT(*) AS count FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'audit_logs' AND index_name = 'uq_audit_logs_event_key'`
      );
      if (!indexes[0].count) {
        await conn.query('CREATE UNIQUE INDEX uq_audit_logs_event_key ON audit_logs (event_key)');
      }
    },
  },
  {
    id: '007_post_approval_profile_edits',
    async up(conn) {
      await conn.query('DROP PROCEDURE IF EXISTS sp_update_application');
      await conn.query(`
        CREATE PROCEDURE sp_update_application(
          IN p_phone VARCHAR(20),
          IN p_name VARCHAR(255),
          IN p_email VARCHAR(255),
          IN p_player_mobile_id VARCHAR(64),
          IN p_player_id BIGINT UNSIGNED,
          IN p_facebook VARCHAR(255),
          IN p_instagram VARCHAR(255),
          IN p_telegram VARCHAR(255),
          OUT p_result_code VARCHAR(32)
        )
        BEGIN
          DECLARE v_status VARCHAR(20) DEFAULT NULL;

          SELECT status INTO v_status FROM applications WHERE phone = p_phone FOR UPDATE;

          IF v_status IS NULL THEN
            SET p_result_code = 'NOT_FOUND';
          ELSEIF v_status NOT IN ('pending_review', 'approved') THEN
            SET p_result_code = 'REVIEW_CLOSED';
          ELSE
            UPDATE applications
            SET name = p_name, email = p_email, player_mobile_id = p_player_mobile_id, player_id = p_player_id,
                facebook = p_facebook, instagram = p_instagram, telegram = p_telegram
            WHERE phone = p_phone;

            SET p_result_code = 'OK';
          END IF;
        END
      `);
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