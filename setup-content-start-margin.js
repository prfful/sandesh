require('dotenv').config();
const mysql = require('mysql2/promise');

async function addColumn() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Checking lettersettings table structure...\n');
    
    // Check if column exists
    const [columns] = await connection.query('SHOW COLUMNS FROM lettersettings');
    const hasColumn = columns.some(col => col.Field === 'content_start_margin');
    
    if (hasColumn) {
      console.log('✓ Column content_start_margin already exists!');
    } else {
      console.log('Adding content_start_margin column...');
      await connection.query(
        'ALTER TABLE lettersettings ADD COLUMN content_start_margin DECIMAL(10,2) DEFAULT 90.00'
      );
      console.log('✓ Column added successfully!\n');
    }
    
    // Update existing records
    console.log('Updating records with default value...');
    await connection.query(
      'UPDATE lettersettings SET content_start_margin = 90.00 WHERE content_start_margin IS NULL'
    );
    console.log('✓ Done!\n');
    
    // Show the column
    const [newColumns] = await connection.query('SHOW COLUMNS FROM lettersettings WHERE Field = "content_start_margin"');
    console.log('Column Details:');
    console.table(newColumns);
    
    // Show current data
    const [data] = await connection.query('SELECT id, content_start_margin FROM lettersettings');
    console.log('\nCurrent Data:');
    console.table(data);
    
    await connection.end();
    console.log('\n✓ All done! Refresh browser and try saving again.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addColumn();
