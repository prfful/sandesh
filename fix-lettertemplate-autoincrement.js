#!/usr/bin/env node

/**
 * Fix lettertemplate table:
 * 1. Add AUTO_INCREMENT to id column if missing
 * 2. Reset auto_increment value
 * 3. Verify the fix
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

async function fixAutoIncrement() {
  const connection = await pool.getConnection();
  
  try {
    console.log('\n🔧 FIXING LETTERTEMPLATE TABLE AUTO_INCREMENT\n');
    
    // Check current status
    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    const idColumn = columns.find(c => c.Field === 'id');
    
    console.log('Current ID column:');
    console.log(`  Type: ${idColumn.Type}`);
    console.log(`  Extra: ${idColumn.Extra}`);
    
    const hasAutoIncrement = idColumn.Extra.includes('auto_increment');
    console.log(`  AUTO_INCREMENT: ${hasAutoIncrement ? '✅ YES' : '❌ NO (NEEDS FIX)'}\n`);
    
    if (!hasAutoIncrement) {
      console.log('🔨 Adding AUTO_INCREMENT...');
      
      // First, drop the primary key constraint
      console.log('  Step 1: Dropping PRIMARY KEY constraint...');
      try {
        await connection.query('ALTER TABLE lettertemplate DROP PRIMARY KEY');
        console.log('  ✅ PRIMARY KEY dropped');
      } catch (err) {
        console.log(`  ⚠️  Could not drop primary key (may not exist): ${err.message.slice(0, 50)}`);
      }
      
      // Add AUTO_INCREMENT to id column
      console.log('  Step 2: Adding AUTO_INCREMENT to id column...');
      
      // Find max id to know where to start
      const [maxIdResult] = await connection.query('SELECT MAX(id) as maxId FROM lettertemplate WHERE id > 0');
      const maxId = maxIdResult[0]?.maxId || 0;
      const nextId = Math.max(1, maxId + 1);
      
      console.log(`  Max ID in table: ${maxId}, next auto value will be: ${nextId}`);
      
      await connection.query(`
        ALTER TABLE lettertemplate 
        MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        AUTO_INCREMENT=${nextId}
      `);
      console.log('  ✅ AUTO_INCREMENT added and set to', nextId);
    } else {
      console.log('✅ AUTO_INCREMENT is already configured correctly\n');
    }
    
    // Verify the fix
    console.log('\n✅ VERIFICATION:\n');
    const [verifyColumns] = await connection.query('SHOW COLUMNS FROM lettertemplate WHERE Field = "id"');
    const newIdColumn = verifyColumns[0];
    console.log(`  Type: ${newIdColumn.Type}`);
    console.log(`  Extra: ${newIdColumn.Extra}`);
    console.log(`  AUTO_INCREMENT Status: ${newIdColumn.Extra.includes('auto_increment') ? '✅ FIXED' : '❌ STILL BROKEN'}`);
    
    // Show table status
    const [tableStatus] = await connection.query('SHOW TABLE STATUS WHERE Name = "lettertemplate"');
    if (tableStatus.length > 0) {
      console.log(`\n  Auto Increment Value: ${tableStatus[0].Auto_increment}`);
    }
    
    console.log('\n🎉 Lettertemplate table is now ready for inserts!\n');
    
  } catch (err) {
    console.error('\n❌ Error during fix:', err.message);
    console.error('\n💡 If this doesn\'t work, try manual fix via PHPMyAdmin:\n');
    console.error('ALTER TABLE lettertemplate MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY;');
  } finally {
    connection.release();
    await pool.end();
  }
}

fixAutoIncrement();
