/**
 * upgrade-image-columns.js
 *
 * Upgrades image-URL columns in lettertemplate and lettersettings from TEXT
 * to MEDIUMTEXT so that base64-encoded images (stored directly in MySQL instead
 * of on disk) fit without truncation.
 *
 * Run once on production after deploying the base64 image storage fix:
 *   node upgrade-image-columns.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    const alterations = [
      // lettertemplate – stores per-template letterhead/signature images
      { table: 'lettertemplate', column: 'letterhead_url' },
      { table: 'lettertemplate', column: 'signature_url' },
      { table: 'lettertemplate', column: 'signature2_url' },
      // lettersettings – stores global page-level letterhead/signature images
      { table: 'lettersettings', column: 'letterhead_url' },
      { table: 'lettersettings', column: 'signature_url' },
    ];

    for (const { table, column } of alterations) {
      // Check the table exists
      const [tables] = await connection.query(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [process.env.DB_NAME || 'sandesh_data', table]
      );
      if (!tables.length) {
        console.log(`⚠️  Table ${table} does not exist – skipping`);
        continue;
      }

      // Check the column exists
      const [cols] = await connection.query('SHOW COLUMNS FROM ?? LIKE ?', [table, column]);
      if (!cols.length) {
        // Column doesn't exist – add it as MEDIUMTEXT
        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` MEDIUMTEXT`);
        console.log(`✅  Added ${table}.${column} as MEDIUMTEXT`);
        continue;
      }

      const currentType = (cols[0].Type || '').toUpperCase();
      if (currentType === 'MEDIUMTEXT' || currentType === 'LONGTEXT') {
        console.log(`✓   ${table}.${column} is already ${currentType} – no change needed`);
        continue;
      }

      await connection.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` MEDIUMTEXT`);
      console.log(`✅  Upgraded ${table}.${column} from ${currentType} → MEDIUMTEXT`);
    }

    console.log('\n✅ Migration complete. Images will now be stored as base64 in the database and will survive all deploys.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
