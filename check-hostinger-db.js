const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Connected to database');

    // Check lettersettings
    const [settings] = await connection.query('SELECT id, letterhead_url, signature_url, page_size FROM lettersettings LIMIT 5');
    console.log('\n=== Letter Settings ===');
    console.log(JSON.stringify(settings, null, 2));

    // Check what files exist in uploads reference
    const [allSettings] = await connection.query('SELECT id, letterhead_url, signature_url FROM lettersettings');
    console.log('\n=== All LetterSettings Records ===');
    allSettings.forEach(s => {
      console.log(`ID: ${s.id}`);
      console.log(`  Letterhead: ${s.letterhead_url}`);
      console.log(`  Signature: ${s.signature_url}`);
    });

    await connection.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDB();
