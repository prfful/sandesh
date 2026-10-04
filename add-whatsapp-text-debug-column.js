// Add whatsapp_text_debug_prompt column to appsettings table
// This is separate from whatsapp_debug_prompt (which is for PDF)
// The new column is for text-only WhatsApp messages (birthday/anniversary bulk)

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('Loading .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading .env');
  dotenv.config({ path: envPath });
}

async function addWhatsAppTextDebugColumn() {
  let connection;
  
  try {
    // Create database connection
    const rawDbHost = process.env.DB_HOST || 'localhost';
    const resolvedDbHost = rawDbHost === 'localhost' ? '127.0.0.1' : rawDbHost;
    
    connection = await mysql.createConnection({
      host: resolvedDbHost,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
    });

    console.log('✅ Connected to database');

    // Check if column already exists
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM appsettings WHERE Field = 'whatsapp_text_debug_prompt'"
    );

    if (columns.length > 0) {
      console.log('✅ Column whatsapp_text_debug_prompt already exists');
      return;
    }

    // Add the new column
    console.log('Adding whatsapp_text_debug_prompt column...');
    await connection.query(`
      ALTER TABLE appsettings 
      ADD COLUMN whatsapp_text_debug_prompt TINYINT(1) DEFAULT 0 
      COMMENT 'Debug mode for text WhatsApp messages (birthday/anniversary bulk)'
    `);

    console.log('✅ Successfully added whatsapp_text_debug_prompt column');
    console.log('');
    console.log('Column details:');
    console.log('- whatsapp_debug_prompt: For PDF WhatsApp (LetterGenerator)');
    console.log('- whatsapp_text_debug_prompt: For Text WhatsApp (BirthdayAnniversaryWishes)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

addWhatsAppTextDebugColumn();
