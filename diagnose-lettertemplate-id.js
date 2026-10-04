#!/usr/bin/env node

/**
 * Diagnose lettertemplate table structure
 * Check if id column has AUTO_INCREMENT
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sandesh_db',
});

try {
  console.log('\n🔍 LETTERTEMPLATE TABLE STRUCTURE:\n');
  console.log('📡 Attempting to connect to database...');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'sandesh_db'}`);
  console.log(`   User: ${process.env.DB_USER || 'root'}\n`);
  
  const connection = await pool.getConnection();
  console.log('✅ Connected to database\n');
  
  // Get the CREATE TABLE statement
  const [createTableResult] = await connection.query('SHOW CREATE TABLE lettertemplate');
  const createTableSQL = createTableResult[0]['Create Table'];
  console.log('CREATE TABLE statement:');
  console.log('─'.repeat(80));
  console.log(createTableSQL);
  console.log('─'.repeat(80));
  
  console.log('\n📋 ID COLUMN DETAILS:\n');
  const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
  columns.forEach(col => {
    if (col.Field === 'id') {
      console.log(`Field:           ${col.Field}`);
      console.log(`Type:            ${col.Type}`);
      console.log(`Null:            ${col.Null}`);
      console.log(`Key:             ${col.Key}`);
      console.log(`Extra:           ${col.Extra}`);
      console.log(`\n${col.Extra.includes('auto_increment') ? '✅ AUTO_INCREMENT: YES' : '❌ AUTO_INCREMENT: NO (PROBLEM!)'}`);
    }
  });
  
  // Show table status
  const [tableStatus] = await connection.query('SHOW TABLE STATUS WHERE Name = "lettertemplate"');
  if (tableStatus.length > 0) {
    console.log(`\nAuto_increment Value: ${tableStatus[0].Auto_increment}`);
  }
  
  connection.release();
  await pool.end();
  
} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error('\nThis usually means:');
  console.error('  1. MySQL is not running locally');
  console.error('  2. Database credentials in .env are wrong');
  console.error('  3. Database/table does not exist');
  console.error('\n💡 This script should be run on the Hostinger server after SSH login.');
  process.exit(1);
}
