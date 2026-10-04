import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkWhatsAppSettings() {
  let connection;
  
  try {
    // First try to connect to remote Hostinger database
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306)
    };

    console.log('Attempting to connect to database...');
    console.log(`Host: ${config.host}`);
    console.log(`Database: ${config.database}`);
    console.log(`User: ${config.user}`);
    
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Check appsettings table structure
    console.log('📋 Current appsettings table structure:');
    const [columns] = await connection.query('SHOW COLUMNS FROM appsettings');
    console.table(columns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Default: col.Default
    })));

    // Check current WhatsApp settings
    console.log('\n📋 Current WhatsApp API settings:');
    const [settings] = await connection.query('SELECT * FROM appsettings LIMIT 1');
    
    if (settings && settings.length > 0) {
      const s = settings[0];
      console.log('\nwhatsapp_api_enabled:', s.whatsapp_api_enabled);
      console.log('whatsapp_mode:', s.whatsapp_mode);
      console.log('whatsapp_api_url:', s.whatsapp_api_url ? s.whatsapp_api_url.substring(0, 150) + '...' : '(empty)');
      console.log('whatsapp_template_name:', s.whatsapp_template_name || '(NOT SET - THIS IS THE PROBLEM!)');
      console.log('whatsapp_direct_message:', s.whatsapp_direct_message);
    } else {
      console.log('No settings found in appsettings table');
    }

    // Check if whatsapp_template_name column exists
    const hasTemplateColumn = columns.some(col => col.Field === 'whatsapp_template_name');
    
    if (!hasTemplateColumn) {
      console.log('\n❌ PROBLEM FOUND: whatsapp_template_name column does NOT exist!');
      console.log('\n🔧 SOLUTION: Run this SQL command on your database:');
      console.log('');
      console.log('ALTER TABLE appsettings ADD COLUMN whatsapp_template_name VARCHAR(255) DEFAULT NULL;');
      console.log('');
    } else {
      console.log('\n✅ whatsapp_template_name column exists');
      
      if (settings && settings.length > 0 && !settings[0].whatsapp_template_name) {
        console.log('⚠️  But it is NOT SET. Go to WhatsApp Settings and select your template (e.g., "dharfc_one")');
      }
    }

    // Show available letter templates
    console.log('\n📋 Available letter templates:');
    const [templates] = await connection.query('SELECT id, name FROM lettertemplate');
    console.table(templates);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Cannot connect to database.');
      console.log('This is likely because the database is on a remote Hostinger server.');
      console.log('\n🔧 SOLUTION: Run the SQL commands manually in Hostinger phpMyAdmin:');
      console.log('');
      console.log('1. Check if column exists:');
      console.log('   SHOW COLUMNS FROM appsettings;');
      console.log('');
      console.log('2. If whatsapp_template_name column is missing, add it:');
      console.log('   ALTER TABLE appsettings ADD COLUMN whatsapp_template_name VARCHAR(255) DEFAULT NULL;');
      console.log('');
      console.log('3. Then go to WhatsApp Settings page and select your template');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

checkWhatsAppSettings();
