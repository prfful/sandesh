#!/usr/bin/env node

/**
 * Clean up any lettertemplate records with empty IDs or NULL template_type
 * This fixes the "Duplicate entry '' for key 'PRIMARY'" error
 * Run this script after deploying the fixed code to Hostinger
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function cleanup() {
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
    
    console.log('🔍 Analyzing lettertemplate table...\n');
    
    // Check for empty string IDs
    const [emptyIds] = await connection.query(
      "SELECT COUNT(*) as count FROM lettertemplate WHERE id = '' OR id = '0' OR id IS NULL"
    );
    
    const emptyCount = emptyIds[0]?.count || 0;
    
    if (emptyCount > 0) {
      console.log(`⚠️  Found ${emptyCount} records with empty/null/zero IDs`);
      console.log('🗑️  Deleting corrupted records...');
      
      const [result] = await connection.query(
        "DELETE FROM lettertemplate WHERE id = '' OR id = '0' OR id IS NULL"
      );
      
      console.log(`✅ Deleted ${result.affectedRows} corrupted records\n`);
    } else {
      console.log('✅ No empty-ID records found\n');
    }
    
    // Check for NULL template_type (should default to 'utility')
    const [nullTypes] = await connection.query(
      "SELECT COUNT(*) as count FROM lettertemplate WHERE template_type IS NULL OR template_type = ''"
    );
    
    const nullTypeCount = nullTypes[0]?.count || 0;
    
    if (nullTypeCount > 0) {
      console.log(`⚠️  Found ${nullTypeCount} records with NULL/empty template_type`);
      console.log('🔧 Fixing template_type to "utility" (default)...');
      
      const [result] = await connection.query(
        "UPDATE lettertemplate SET template_type = 'utility' WHERE template_type IS NULL OR template_type = ''"
      );
      
      console.log(`✅ Fixed ${result.affectedRows} records\n`);
    } else {
      console.log('✅ No NULL template_type records found\n');
    }
    
    // Show summary of remaining records
    const [summary] = await connection.query(
      "SELECT COUNT(*) as total, template_type FROM lettertemplate GROUP BY template_type"
    );
    
    console.log('📊 Current lettertemplate records:');
    let grandTotal = 0;
    summary.forEach(row => {
      console.log(`  - ${row.template_type || '(null)'}: ${row.total} records`);
      grandTotal += row.total;
    });
    console.log(`\n  📍 Total: ${grandTotal} records\n`);
    
    // Verify table structure
    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log('✅ Table structure verified:');
    columns.forEach(col => {
      if (['id', 'template_type', 'name', 'program_type'].includes(col.Field)) {
        console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'NOT NULL'})`);
      }
    });
    
    connection.release();
    await pool.end();
    
    console.log('\n✅ Cleanup complete! Database is ready for template creation.');
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    process.exit(1);
  }
}

cleanup();
