require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTemplate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('--- Checking विवाह Template ---\n');
  
  const [rows] = await connection.query('SELECT * FROM lettertemplate WHERE name = ?', ['विवाह']);
  
  if (rows.length === 0) {
    console.log('No template found!');
  } else {
    const template = rows[0];
    console.log('Template ID:', template.id);
    console.log('Template Name:', template.name);
    console.log('Program Type:', template.program_type);
    console.log('\n--- BODY FIELD ---');
    console.log('Body Length:', template.body ? template.body.length : 0);
    console.log('Body Content:');
    console.log('"""');
    console.log(template.body);
    console.log('"""');
    console.log('\nFirst 100 characters:', template.body ? template.body.substring(0, 100) : 'NULL');
    console.log('\nLast 100 characters:', template.body ? template.body.substring(template.body.length - 100) : 'NULL');
  }

  await connection.end();
}

checkTemplate().catch(console.error);
