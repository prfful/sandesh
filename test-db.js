import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing MySQL Connection...\n');
console.log('Configuration:');
console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`  Port: ${process.env.DB_PORT || 3306}`);
console.log(`  User: ${process.env.DB_USER || 'root'}`);
console.log(`  Password: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : '(empty)'}`);
console.log(`  Database: ${process.env.DB_NAME || 'sandesh_data'}`);
console.log('\n--- Test 1: Connect without database ---');

try {
  const connection1 = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  });
  console.log('✅ Connection successful (without database)!');
  
  console.log('\n--- Test 2: List all databases ---');
  const [databases] = await connection1.query('SHOW DATABASES');
  console.log('Available databases:');
  databases.forEach(db => console.log(`  - ${db.Database}`));
  
  const dbExists = databases.some(db => db.Database === (process.env.DB_NAME || 'sandesh_data'));
  if (dbExists) {
    console.log(`\n✅ Database "${process.env.DB_NAME || 'sandesh_data'}" exists!`);
  } else {
    console.log(`\n❌ Database "${process.env.DB_NAME || 'sandesh_data'}" NOT FOUND!`);
    console.log('   Please create it first.');
  }
  
  await connection1.end();
  
  if (dbExists) {
    console.log('\n--- Test 3: Connect with database ---');
    const connection2 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sandesh_data',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    });
    console.log('✅ Connection with database successful!');
    
    console.log('\n--- Test 4: List tables ---');
    const [tables] = await connection2.query('SHOW TABLES');
    if (tables.length > 0) {
      console.log('Tables found:');
      tables.forEach(table => console.log(`  - ${Object.values(table)[0]}`));
    } else {
      console.log('No tables found in database.');
    }
    
    await connection2.end();
  }
  
  console.log('\n🎉 All tests passed! Your MySQL connection is working.');
  
} catch (error) {
  console.error('\n❌ Connection failed!');
  console.error('Error Code:', error.code);
  console.error('Error Message:', error.message);
  console.error('\nPossible solutions:');
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('  1. Check if username is correct (try "root" or another user)');
    console.error('  2. Check if password is correct');
    console.error('  3. Try empty password: DB_PASSWORD=');
    console.error('  4. Check MySQL user permissions');
    console.error('  5. If special characters in password, make sure they are correct');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('  1. Make sure MySQL is running');
    console.error('  2. Check if port 3306 is correct');
  }
  process.exit(1);
}
