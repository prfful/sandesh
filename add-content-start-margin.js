require('dotenv').config();
const mysql = require('mysql2/promise');

async function addContentStartMargin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Checking if content_start_margin column exists...');
    
    const [columns] = await connection.query('SHOW COLUMNS FROM lettersettings');
    const columnExists = columns.some(col => col.Field === 'content_start_margin');
    
    if (columnExists) {
      console.log('✓ Column content_start_margin already exists');
    } else {
      console.log('Adding content_start_margin column...');
      await connection.query(
        'ALTER TABLE lettersettings ADD COLUMN content_start_margin DECIMAL(10,2) DEFAULT 90.00 AFTER letterhead_width'
      );
      console.log('✓ Column content_start_margin added successfully');
    }
    
    // Update existing record with default value
    console.log('\nUpdating existing records...');
    await connection.query(
      'UPDATE lettersettings SET content_start_margin = 90.00 WHERE content_start_margin IS NULL'
    );
    console.log('✓ Existing records updated');
    
    // Show current structure
    console.log('\n--- Current lettersettings structure ---');
    const [newColumns] = await connection.query('SHOW COLUMNS FROM lettersettings');
    console.table(newColumns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Default: col.Default
    })));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addContentStartMargin();
