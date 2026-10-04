import 'dotenv/config.js';
import mysql from 'mysql2/promise';
import process from 'process';

const checkDatabase = async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('=== CHECKING DATABASE ===\n');
    
    // Check if column exists
    const [columns] = await conn.query('SHOW COLUMNS FROM lettersettings');
    console.log('Current columns in lettersettings table:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    const hasColumn = columns.some(col => col.Field === 'content_start_margin');
    console.log(`\n✓ content_start_margin EXISTS: ${hasColumn}\n`);
    
    if (!hasColumn) {
      console.log('⏳ Adding column now...');
      await conn.query('ALTER TABLE lettersettings ADD COLUMN content_start_margin DECIMAL(10,2) DEFAULT 90');
      console.log('✓ Column added!\n');
    }
    
    // Check data
    const [data] = await conn.query('SELECT id, content_start_margin FROM lettersettings');
    console.log('Current data:');
    console.table(data);
    
    await conn.end();
    console.log('\n✓ READY TO USE - Refresh browser and try saving!');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
};

checkDatabase();
