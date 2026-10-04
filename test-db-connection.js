import 'dotenv/config';
import mysql from 'mysql2/promise';

console.log('Database Config:');
console.log(`Host: ${process.env.DB_HOST}`);
console.log(`User: ${process.env.DB_USER}`);
console.log(`Database: ${process.env.DB_NAME}`);
console.log(`Port: ${process.env.DB_PORT || 3306}`);

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 2,
      queueLimit: 0,
    });

    console.log('\nAttempting connection...');
    const conn = await pool.getConnection();
    console.log('✓ Connected successfully!\n');
    
    console.log('=== PRAGRAM TABLE STRUCTURE ===\n');
    const [columns] = await conn.query('SHOW COLUMNS FROM pragram');
    columns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} | Key: ${col.Key || 'NONE'}`);
    });

    console.log('\n=== FIRST RECORD ===\n');
    const [rows] = await conn.query('SELECT * FROM pragram LIMIT 1');
    if (rows.length > 0) {
      Object.entries(rows[0]).forEach(([key, val]) => {
        console.log(`${key}: ${val}`);
      });
    }

    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Connection failed:');
    console.error(err.message);
    process.exit(1);
  }
})();
