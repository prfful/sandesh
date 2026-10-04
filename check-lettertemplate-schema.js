#!/usr/bin/env node

/**
 * Check the actual schema of lettertemplate table to understand data types and constraints
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function checkSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('📋 LETTERTEMPLATE TABLE SCHEMA:\n');
    
    // Get column information
    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log('Columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field.padEnd(30)} | Type: ${col.Type.padEnd(20)} | Null: ${col.Null} | Key: ${col.Key || 'NONE'} | Extra: ${col.Extra}`);
    });
    
    // Get table constraints and foreign keys
    const [createTable] = await connection.query('SHOW CREATE TABLE lettertemplate');
    console.log('\n\n📌 CREATE TABLE STATEMENT:\n');
    console.log(createTable[0]['Create Table']);
    
    // Check for foreign key constraints
    console.log('\n\n🔗 FOREIGN KEY INFORMATION:\n');
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'lettertemplate' AND TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (constraints.length > 0) {
      console.log('Foreign Keys Found:');
      constraints.forEach(fk => {
        console.log(`  - ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('No foreign key constraints found.');
    }
    
    // Sample data
    console.log('\n\n📊 SAMPLE DATA (First 3 records):\n');
    const [samples] = await connection.query('SELECT id, name, template_type, program_type FROM lettertemplate LIMIT 3');
    console.log('Sample records:');
    samples.forEach((row, idx) => {
      console.log(`  [${idx+1}] id: ${row.id}, name: ${row.name}, template_type: ${row.template_type}, program_type: ${row.program_type} (type: ${typeof row.program_type})`);
    });
    
    // Check programtype table
    console.log('\n\n📚 PROGRAMTYPE TABLE CONTENTS:\n');
    const [programTypes] = await connection.query('SELECT id, programtyp FROM programtype');
    console.log('Program Types:');
    programTypes.forEach(pt => {
      console.log(`  - ID: ${pt.id}, Name: ${pt.programtyp}`);
    });
    
    connection.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkSchema();
