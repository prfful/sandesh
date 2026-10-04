import 'dotenv/config';
import mysql from 'mysql2/promise';

const hostnames = [
  'seagreen-woodcock-382393.hostingersite.com',
  'localhost',
  '127.0.0.1',
  'sql123.hostinger.com',
  'seagreen-woodcock-382393',
  'u590837060.mysql.db', 
  'mysql.hostinger.com',
];

console.log('Testing multiple Hostinger hostnames...\n');

for (const host of hostnames) {
  process.stdout.write(`Testing ${host}... `);
  
  try {
    const pool = mysql.createPool({
      host: host,
      port: 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: false,
      connectionLimit: 1,
      queueLimit: 0,
    });

    const conn = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
    ]);

    console.log('✓ CONNECTED!');
    console.log(`\n✓ Use this hostname: ${host}\n`);
    
    // Show table structure
    const [columns] = await conn.query('SHOW COLUMNS FROM pragram');
    console.log('Table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.log('✗');
  }
}

console.log('\n✗ None of the hostnames worked.');
console.log('\nPlease check your Hostinger database credentials in the control panel.');
process.exit(1);
