import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

async function addTextWhatsAppColumns() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✅ Connected to database');
    
    // Check current schema
    console.log('\n📋 Current appsettings schema:');
    const [currentColumns] = await connection.query('SHOW COLUMNS FROM appsettings');
    currentColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check if columns already exist
    const columnNames = currentColumns.map(col => col.Field);
    const columnsToAdd = [
      { name: 'whatsapp_text_api_url', exists: columnNames.includes('whatsapp_text_api_url') },
      { name: 'whatsapp_text_template_name', exists: columnNames.includes('whatsapp_text_template_name') },
      { name: 'whatsapp_text_api_enabled', exists: columnNames.includes('whatsapp_text_api_enabled') }
    ];
    
    console.log('\n🔍 Column status:');
    columnsToAdd.forEach(col => {
      console.log(`  - ${col.name}: ${col.exists ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
    // Add missing columns
    let addedCount = 0;
    
    if (!columnsToAdd[0].exists) {
      console.log('\n➕ Adding whatsapp_text_api_url column...');
      await connection.query(`
        ALTER TABLE appsettings 
        ADD COLUMN whatsapp_text_api_url TEXT 
        COMMENT 'WhatsApp TEXT template API URL for bulk text messages'
      `);
      console.log('✅ Added whatsapp_text_api_url');
      addedCount++;
    }
    
    if (!columnsToAdd[1].exists) {
      console.log('\n➕ Adding whatsapp_text_template_name column...');
      await connection.query(`
        ALTER TABLE appsettings 
        ADD COLUMN whatsapp_text_template_name VARCHAR(255) 
        COMMENT 'WhatsApp TEXT template name (e.g., team_neenavverma_01)'
      `);
      console.log('✅ Added whatsapp_text_template_name');
      addedCount++;
    }
    
    if (!columnsToAdd[2].exists) {
      console.log('\n➕ Adding whatsapp_text_api_enabled column...');
      await connection.query(`
        ALTER TABLE appsettings 
        ADD COLUMN whatsapp_text_api_enabled TINYINT(1) DEFAULT 0 
        COMMENT 'Enable/disable WhatsApp TEXT API for bulk messages'
      `);
      console.log('✅ Added whatsapp_text_api_enabled');
      addedCount++;
    }
    
    // Rename existing columns for clarity (if not already renamed)
    if (columnNames.includes('whatsapp_api_url') && !columnNames.includes('whatsapp_pdf_api_url')) {
      console.log('\n🔄 Renaming whatsapp_api_url to whatsapp_pdf_api_url...');
      await connection.query(`
        ALTER TABLE appsettings 
        CHANGE COLUMN whatsapp_api_url whatsapp_pdf_api_url TEXT
        COMMENT 'WhatsApp UTILITY template API URL for PDF invitations'
      `);
      console.log('✅ Renamed to whatsapp_pdf_api_url');
      addedCount++;
    }
    
    if (columnNames.includes('whatsapp_api_enabled') && !columnNames.includes('whatsapp_pdf_api_enabled')) {
      console.log('\n🔄 Renaming whatsapp_api_enabled to whatsapp_pdf_api_enabled...');
      await connection.query(`
        ALTER TABLE appsettings 
        CHANGE COLUMN whatsapp_api_enabled whatsapp_pdf_api_enabled TINYINT(1) DEFAULT 0
        COMMENT 'Enable/disable WhatsApp UTILITY API for PDF invitations'
      `);
      console.log('✅ Renamed to whatsapp_pdf_api_enabled');
      addedCount++;
    }
    
    // Show final schema
    console.log('\n📋 Updated appsettings schema:');
    const [updatedColumns] = await connection.query('SHOW COLUMNS FROM appsettings');
    updatedColumns.forEach(col => {
      if (col.Field.includes('whatsapp')) {
        console.log(`  ✓ ${col.Field} (${col.Type})`);
      }
    });
    
    console.log(`\n✅ Schema update complete! (${addedCount} changes made)`);
    console.log('\n💡 Next steps:');
    console.log('   1. Update WhatsAppSettings.jsx to show separate PDF and TEXT sections');
    console.log('   2. Update BirthdayAnniversaryWishes.jsx to use TEXT API');
    console.log('   3. Configure TEXT API URL in WhatsApp Settings page');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
addTextWhatsAppColumns().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
