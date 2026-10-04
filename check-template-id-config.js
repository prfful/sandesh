// check-template-id-config.js - Check if template_id is configured
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkConfig() {
  let connection;
  
  try {
    console.log('🔍 Checking WhatsApp TEXT API Template Configuration...\n');
    
    // Try to connect to production database (Hostinger)
    const isProduction = process.env.DB_HOST && process.env.DB_HOST !== 'localhost';
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log(`✅ Connected to ${isProduction ? 'PRODUCTION (Hostinger)' : 'LOCAL'} database\n`);

    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appsettings'
      AND COLUMN_NAME = 'whatsapp_text_template_name'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      console.log('❌ CRITICAL: whatsapp_text_template_name column does NOT exist!');
      console.log('\n📝 To fix, run this SQL on Hostinger:');
      console.log('ALTER TABLE appsettings ADD COLUMN whatsapp_text_template_name VARCHAR(255) DEFAULT NULL;');
      console.log('\nOr create the file: add-template-column.sql\n');
      await connection.end();
      return;
    }

    console.log('✅ Column whatsapp_text_template_name exists\n');

    // Get current settings
    const [settings] = await connection.query(`
      SELECT 
        whatsapp_text_api_enabled,
        whatsapp_text_api_url,
        whatsapp_text_template_name,
        whatsapp_text_debug_prompt
      FROM appsettings 
      LIMIT 1
    `);

    if (!settings || settings.length === 0) {
      console.log('⚠️  No settings found in appsettings table');
      await connection.end();
      return;
    }

    const config = settings[0];
    
    console.log('📊 Current Configuration:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TEXT API Enabled: ${config.whatsapp_text_api_enabled ? '✅ Yes' : '❌ No'}`);
    console.log(`Debug Mode: ${config.whatsapp_text_debug_prompt ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`\nAPI URL: ${config.whatsapp_text_api_url ? '✅ Set' : '❌ NOT SET'}`);
    
    if (config.whatsapp_text_api_url) {
      console.log(`└─ ${config.whatsapp_text_api_url.substring(0, 80)}...`);
      
      // Check if URL contains template_id
      if (config.whatsapp_text_api_url.includes('template_id=')) {
        const match = config.whatsapp_text_api_url.match(/template_id=([^&\s]+)/);
        console.log(`   └─ URL has template_id: ⚠️ ${match ? match[1] : 'found'} (should be in separate field)`);
      }
    }
    
    console.log(`\nTemplate Name: ${config.whatsapp_text_template_name ? '✅ ' + config.whatsapp_text_template_name : '❌ NOT SET ⚠️'}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    
    // Diagnose issues
    const issues = [];
    
    if (!config.whatsapp_text_api_enabled) {
      issues.push('❌ TEXT API is DISABLED in WhatsApp Settings');
    }
    
    if (!config.whatsapp_text_api_url) {
      issues.push('❌ API URL is NOT configured');
    }
    
    if (!config.whatsapp_text_template_name) {
      issues.push('❌ Template Name is NOT CONFIGURED - Messages will queue but not deliver!');
    }
    
    if (!config.whatsapp_text_debug_prompt) {
      issues.push('⚠️  Debug mode is DISABLED - URL popup will not show');
    }

    if (issues.length > 0) {
      console.log('\n🚨 ISSUES FOUND:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      
      console.log('\n📝 TO FIX:');
      console.log('1. Login to your app: https://seagreen-woodcock-382393.hostingersite.com');
      console.log('2. Go to WhatsApp Settings page');
      
      if (!config.whatsapp_text_template_name) {
        console.log('3. ⚠️  IMPORTANT: Enter Template Name (e.g., "teamneenavverma")');
      }
      
      if (!config.whatsapp_text_debug_prompt) {
        console.log('4. Enable "TEXT API डिबग मोड" checkbox');
      }
      
      console.log('5. Click "सहेजें" (Save)');
      console.log('6. Test bulk send again');
      
    } else {
      console.log('\n✅ All settings configured correctly!');
      console.log('\n📝 Expected API URL when sending:');
      console.log(`${config.whatsapp_text_api_url}`);
      console.log(`└─ Server will add: &template_id=${config.whatsapp_text_template_name}`);
      
      console.log('\n🔍 To verify, check server logs for:');
      console.log('"Final Text Message API URL:" should contain template_id parameter');
    }

    await connection.end();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Cannot connect to database.');
      console.log('For local: Start MySQL service');
      console.log('For Hostinger: Check .env has production credentials');
    }
    
    if (connection) {
      await connection.end();
    }
  }
}

checkConfig();
