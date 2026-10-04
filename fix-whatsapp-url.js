#!/usr/bin/env node

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const CORRECT_URL = 'https://bhashsms.com/api/sendmsg.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone={{Mob}}&text=team_neena_verma9&params={{Name}},{{Message}}&priority=wa&stype=normal';

async function checkAndFixURL() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('🔍 Checking current WhatsApp API URL...\n');

    const [rows] = await pool.query('SELECT id, whatsapp_text_api_url FROM appsettings LIMIT 1');

    if (!rows || rows.length === 0) {
      console.log('❌ No appsettings record found!');
      pool.end();
      return;
    }

    const current = rows[0].whatsapp_text_api_url || '';
    const id = rows[0].id;

    console.log('📋 CURRENT URL:');
    console.log('─'.repeat(100));
    console.log(current);
    console.log('─'.repeat(100));
    console.log();

    console.log('✅ CORRECT URL:');
    console.log('─'.repeat(100));
    console.log(CORRECT_URL);
    console.log('─'.repeat(100));
    console.log();

    if (current === CORRECT_URL) {
      console.log('✅ URL is already correct! No changes needed.');
      pool.end();
      return;
    }

    console.log('🔄 Updating to correct format...\n');
    
    // Update the URL
    const [result] = await pool.query(
      'UPDATE appsettings SET whatsapp_text_api_url = ? WHERE id = ?',
      [CORRECT_URL, id]
    );

    if (result.affectedRows > 0) {
      console.log('✅ Successfully updated!');
      console.log(`   ID: ${id}`);
      console.log(`   Rows affected: ${result.affectedRows}`);
      console.log();
      console.log('📝 Verify the change:');
      const [verify] = await pool.query('SELECT whatsapp_text_api_url FROM appsettings WHERE id = ?', [id]);
      console.log('─'.repeat(100));
      console.log(verify[0].whatsapp_text_api_url);
      console.log('─'.repeat(100));
    } else {
      console.log('❌ No rows updated!');
    }

    pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndFixURL();
