import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Checking lettersettings table schema...\n');

    // Get current columns
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM lettersettings
    `);

    const existingColumns = columns.map(col => col.Field);
    console.log('Existing columns:', existingColumns);

    const newColumns = [
      { name: 'letterhead_top_margin', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'letterhead_height', type: 'DECIMAL(10,2)', default: '80' },
      { name: 'signature_right_margin', type: 'DECIMAL(10,2)', default: '20' },
      { name: 'signature_bottom_margin', type: 'DECIMAL(10,2)', default: '80' },
      { name: 'signature_height', type: 'DECIMAL(10,2)', default: '60' },
    ];

    console.log('\nAdding missing columns...\n');

    for (const col of newColumns) {
      if (!existingColumns.includes(col.name)) {
        const sql = `ALTER TABLE lettersettings ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`;
        console.log(`Adding column: ${col.name}`);
        await connection.query(sql);
        console.log(`✓ Added ${col.name}`);
      } else {
        console.log(`✓ Column ${col.name} already exists`);
      }
    }

    console.log('\n--- Schema update complete ---');

    // Show updated schema
    const [updatedColumns] = await connection.query(`SHOW COLUMNS FROM lettersettings`);
    console.log('\nUpdated table structure:');
    updatedColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

updateSchema();
