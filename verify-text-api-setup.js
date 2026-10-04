// verify-text-api-setup.js - Check if TEXT API is properly configured
require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifySetup() {
  let connection;
  
  try {
    console.log('🔍 Verifying WhatsApp TEXT API Setup...\n');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Database connection established\n');

    // Check if whatsapp_text_template_name column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appsettings'
      AND COLUMN_NAME LIKE 'whatsapp_text%'
      ORDER BY COLUMN_NAME
    `, [process.env.DB_NAME]);

    console.log('📋 WhatsApp TEXT API Columns in appsettings table:');
    console.log('─────────────────────────────────────────────────────────');
    
    const requiredColumns = {
      whatsapp_text_api_url: false,
      whatsapp_text_api_enabled: false,
      whatsapp_text_template_name: false
    };

    columns.forEach(col => {
      console.log(`✓ ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
      requiredColumns[col.COLUMN_NAME] = true;
    });

    console.log('\n📊 Required Columns Status:');
    console.log('─────────────────────────────────────────────────────────');
    
    let allPresent = true;
    Object.keys(requiredColumns).forEach(colName => {
      const status = requiredColumns[colName] ? '✅' : '❌';
      console.log(`${status} ${colName}`);
      if (!requiredColumns[colName]) {
        allPresent = false;
      }
    });

    if (!allPresent) {
      console.log('\n⚠️  MISSING COLUMNS DETECTED!');
      console.log('\nTo add missing columns, run:');
      console.log('node add-whatsapp-template-column.js\n');
      return;
    }

    // Check current settings
    const [settings] = await connection.query('SELECT whatsapp_text_api_url, whatsapp_text_api_enabled, whatsapp_text_template_name FROM appsettings LIMIT 1');
    
    if (!settings || settings.length === 0) {
      console.log('\n⚠️  No settings found in appsettings table');
      return;
    }

    const config = settings[0];
    
    console.log('\n⚙️  Current Configuration:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Enabled: ${config.whatsapp_text_api_enabled ? '✅ Yes' : '❌ No'}`);
    console.log(`API URL: ${config.whatsapp_text_api_url ? '✅ Set' : '❌ Not Set'}`);
    console.log(`Template Name: ${config.whatsapp_text_template_name ? `✅ ${config.whatsapp_text_template_name}` : '❌ Not Set'}`);

    if (config.whatsapp_text_api_url) {
      console.log(`\nFull URL: ${config.whatsapp_text_api_url.substring(0, 100)}...`);
      
      // Check if URL has template_id
      if (config.whatsapp_text_api_url.includes('template_id=')) {
        const match = config.whatsapp_text_api_url.match(/template_id=([^&\s]+)/);
        if (match) {
          console.log(`URL Template ID: ✅ ${match[1]}`);
        }
      } else {
        console.log('URL Template ID: ⚠️  Not in URL (will be added by server from Template Name field)');
      }
    }

    console.log('\n🎯 Setup Status:');
    console.log('─────────────────────────────────────────────────────────');
    
    const issues = [];
    
    if (!config.whatsapp_text_api_enabled) {
      issues.push('❌ TEXT API not enabled - Enable in WhatsApp Settings page');
    }
    
    if (!config.whatsapp_text_api_url) {
      issues.push('❌ API URL not set - Configure in WhatsApp Settings page');
    }
    
    if (!config.whatsapp_text_template_name) {
      issues.push('⚠️  Template Name not set - Server will not add template_id parameter');
    }

    if (issues.length === 0) {
      console.log('✅ TEXT API fully configured and ready!');
      console.log('\n📝 Next Steps:');
      console.log('1. Deploy updated server.js to Hostinger');
      console.log('2. Test bulk send from Birthday/Anniversary Wishes page');
      console.log('3. Check server logs for "Final Text Message API URL" with template_id parameter');
    } else {
      console.log('⚠️  Configuration incomplete:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n📝 Fix in WhatsApp Settings page:');
      console.log('1. Enable TEXT API');
      console.log('2. Enter API URL from BHASHSMS');
      console.log('3. Enter Template Name (e.g., teamneenavverma)');
      console.log('4. Click Save');
    }

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Database connection refused. Check:');
      console.log('   - MySQL service is running');
      console.log('   - DB_HOST, DB_USER, DB_PASSWORD in .env are correct');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifySetup();
