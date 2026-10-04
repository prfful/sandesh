// Script to add page_permissions column to operator table
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function addPagePermissions() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Connected to database');

    // Check if page_permissions column exists
    const [columns] = await connection.query('SHOW COLUMNS FROM operator');
    console.log('\nCurrent columns:');
    columns.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

    const hasPagePermissions = columns.some(col => col.Field === 'page_permissions');

    if (!hasPagePermissions) {
      console.log('\n✅ Adding page_permissions column...');
      await connection.query(`
        ALTER TABLE operator 
        ADD COLUMN page_permissions LONGTEXT NULL COMMENT 'JSON array of page names user can access'
      `);
      console.log('✅ page_permissions column added successfully');
    } else {
      console.log('\n✓ page_permissions column already exists');
    }

    // Show updated schema
    console.log('\n✅ Updated schema:');
    const [updatedColumns] = await connection.query('SHOW COLUMNS FROM operator');
    updatedColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    console.log('\n✅ Database schema updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addPagePermissions();
