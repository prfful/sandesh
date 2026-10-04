import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sandesh_data',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

console.log('Cleaning corrupted lettersettings data...');

// Get existing data before cleanup (to preserve image URLs)
const [existingRows] = await connection.query('SELECT letterhead_url, signature_url FROM lettersettings LIMIT 1');
const existingUrls = existingRows && existingRows.length > 0 ? existingRows[0] : { letterhead_url: null, signature_url: null };

console.log('Preserving image URLs:');
console.log('  Letterhead URL:', existingUrls.letterhead_url || 'none');
console.log('  Signature URL:', existingUrls.signature_url || 'none');

// Delete all records
await connection.query('DELETE FROM lettersettings');
console.log('✅ All corrupted records deleted');

// Insert a fresh default record with preserved image URLs
const defaultSettings = {
  id: 'default_settings',
  page_size: 'A4',
  page_width: 210,
  page_height: 297,
  margin_unit: 'mm',
  margin_top: 20,
  margin_bottom: 20,
  margin_left: 20,
  margin_right: 20,
  letterhead_url: existingUrls.letterhead_url || null,  // Preserve existing URL
  signature_url: existingUrls.signature_url || null,    // Preserve existing URL
  is_active: 1,
  created_date: new Date(),
  updated_date: new Date()
};

await connection.query('INSERT INTO lettersettings SET ?', defaultSettings);
console.log('✅ Default settings inserted with preserved image URLs');

// Verify
const [rows] = await connection.query('SELECT * FROM lettersettings');
console.log('\nCurrent data:');
console.log(rows[0]);

await connection.end();
console.log('\n✅ Database cleaned successfully! Image URLs preserved.');

