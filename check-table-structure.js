import 'dotenv/config';
import mysql from 'mysql2/promise';

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    });

    const conn = await pool.getConnection();
    
    console.log('\n=== PRAGRAM TABLE STRUCTURE ===\n');
    const [columns] = await conn.query('SHOW COLUMNS FROM pragram');
    columns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} | Key: ${col.Key || 'NONE'} | Null: ${col.Null}`);
    });

    console.log('\n=== SAMPLE DATA (first 3 rows) ===\n');
    const [rows] = await conn.query('SELECT * FROM pragram LIMIT 3');
    rows.forEach((row, idx) => {
      console.log(`\nRow ${idx + 1}:`);
      Object.entries(row).forEach(([key, val]) => {
        console.log(`  ${key}: ${val}`);
      });
    });

    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
