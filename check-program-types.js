#!/usr/bin/env node

/**
 * Quick check - what program types exist in the database?
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
  const connection = await pool.getConnection();
  
  console.log('\n📚 PROGRAMTYPE TABLE:\n');
  const [types] = await connection.query('SELECT * FROM programtype ORDER BY id');
  types.forEach(t => {
    console.log(`ID: ${t.id} → "${t.programtyp}"`);
  });
  
  console.log('\n\n📋 LETTERTEMPLATE DATA:\n');
  const [templates] = await connection.query('SELECT id, name, template_type, program_type FROM lettertemplate');
  templates.forEach(t => {
    console.log(`ID: ${t.id} | Type: ${t.template_type} | ProgramType: "${t.program_type}"`);
  });
  
  connection.release();
  await pool.end();
} catch (err) {
  console.error('Error:', err.message);
}
