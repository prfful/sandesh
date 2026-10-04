import 'dotenv/config';
import mysql from 'mysql2/promise';

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const conn = await pool.getConnection();

    console.log('Checking pragram table structure...');
    const [columns] = await conn.query('SHOW COLUMNS FROM pragram');
    const hasId = columns.some(col => col.Field === 'id');

    if (hasId) {
      console.log('✓ Table already has id column');
      conn.release();
      process.exit(0);
    }

    console.log('✗ id column not found. Adding it...');

    // Add id column as primary key at the beginning
    await conn.query(`
      ALTER TABLE pragram 
      ADD COLUMN id INT AUTO_INCREMENT UNIQUE FIRST
    `);

    console.log('✓ Successfully added id column as auto-increment');

    // Get a sample to verify
    const [sample] = await conn.query('SELECT id, Sn FROM pragram LIMIT 3');
    console.log('\nSample records:');
    sample.forEach((row, idx) => {
      console.log(`  ${idx + 1}. id: ${row.id}, Sn: ${row.Sn}`);
    });

    conn.release();
    console.log('\n✓ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
