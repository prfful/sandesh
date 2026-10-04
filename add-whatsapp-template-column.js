import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addWhatsAppTemplateColumn() {
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
    const columnExists = columns.some(col => col.Field === 'whatsapp_template_name');

    if (columnExists) {
      console.log('⚠️  Column whatsapp_template_name already exists');
    } else {
      console.log('Adding whatsapp_template_name column...');
      await connection.query(`
        ALTER TABLE appsettings 
        ADD COLUMN whatsapp_template_name VARCHAR(255) DEFAULT NULL COMMENT 'Letter template name to use for WhatsApp messages'
      `);
      console.log('✅ Column whatsapp_template_name added successfully');
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

    console.log('\n💡 Next steps:');
    console.log('1. Go to WhatsApp Settings page');
    console.log('2. Select your letter template (e.g., "dharfc_one")');
    console.log('3. Save settings');
    console.log('4. The template content will now be used in WhatsApp messages');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

addWhatsAppTemplateColumn();
