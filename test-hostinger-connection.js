import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing Hostinger MySQL connection...\n');
  console.log('Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
    });

    console.log('\n✅ Connected to MySQL!');

    // Check tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📋 Tables in database:', tables.map(t => Object.values(t)[0]));

    // Check pragram table
    try {
      const [pragramData] = await connection.query('SELECT COUNT(*) as count FROM pragram');
      console.log('\n📊 Pragram table:', pragramData[0].count, 'records');
    } catch (e) {
      console.log('\n⚠️ Pragram table query failed:', e.message);
    }

    // Check programtype table
    try {
      const [typesData] = await connection.query('SELECT COUNT(*) as count FROM programtype');
      console.log('📊 ProgramType table:', typesData[0].count, 'records');
    } catch (e) {
      console.log('⚠️ ProgramType table query failed:', e.message);
    }

    await connection.end();
    console.log('\n✅ Connection test completed successfully!');
  } catch (err) {
    console.error('\n❌ Connection failed:', err.code || 'UNKNOWN');
    console.error('Error:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env');
    console.error('2. Verify credentials in Hostinger cPanel → MySQL Databases');
    console.error('3. Check firewall/IP whitelist in cPanel');
    console.error('4. Ensure MySQL service is running in cPanel');
  }
}

testConnection();
