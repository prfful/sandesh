const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addWhatsAppDebugColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306)
    });

    console.log('✅ Connected to database');

    // Check if column exists
    const [columns] = await connection.query('SHOW COLUMNS FROM appsettings');
    const columnExists = columns.some(col => col.Field === 'whatsapp_debug_prompt');

    if (columnExists) {
      console.log('⚠️  Column whatsapp_debug_prompt already exists');
    } else {
      console.log('Adding whatsapp_debug_prompt column...');
      await connection.query(`
        ALTER TABLE appsettings 
        ADD COLUMN whatsapp_debug_prompt BOOLEAN DEFAULT FALSE COMMENT 'Show debug prompt when sending WhatsApp'
      `);
      console.log('✅ Column whatsapp_debug_prompt added successfully');
    }

    // Show final schema
    console.log('\n📋 Current appsettings schema:');
    const [finalColumns] = await connection.query('SHOW COLUMNS FROM appsettings');
    console.table(finalColumns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Default: col.Default
    })));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

addWhatsAppDebugColumn();
