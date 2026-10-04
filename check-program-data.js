import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sandesh_data',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

console.log('--- Checking Program Data ---\n');

// Get one sample program
const [programs] = await connection.query('SELECT * FROM pragram LIMIT 1');
const program = programs[0];

if (program) {
  console.log('Sample Program:');
  console.log('ID:', program.id);
  console.log('SenderName:', program.SenderName);
  console.log('Village:', program.Village);
  console.log('District:', program.District);
  console.log('programtyp:', program.programtyp);
  console.log('Date:', program.Date);
  console.log('Sn:', program.Sn);
  
  // Check for any field with unusually large content
  for (const [key, value] of Object.entries(program)) {
    if (typeof value === 'string' && value.length > 1000) {
      console.log(`\n⚠️ WARNING: Field "${key}" has ${value.length} characters!`);
      console.log('First 200 chars:', value.substring(0, 200));
    }
  }
} else {
  console.log('No programs found in database');
}

// Check letter templates
console.log('\n--- Checking Letter Templates ---\n');
const [templates] = await connection.query('SELECT * FROM lettertemplate LIMIT 1');
const template = templates[0];

if (template) {
  console.log('Sample Template:');
  console.log('ID:', template.id);
  console.log('Name:', template.name);
  console.log('Body length:', template.body?.length || 0);
  
  if (template.body && template.body.length > 1000) {
    console.log('\n⚠️ WARNING: Template body has', template.body.length, 'characters!');
    console.log('First 500 chars:', template.body.substring(0, 500));
  }
}

await connection.end();
