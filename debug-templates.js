import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    console.log('=== LETTER TEMPLATES ===');
    const [templates] = await conn.query('SELECT id, name, program_type, CHAR_LENGTH(body) as body_length, body FROM lettertemplate LIMIT 10');
    
    if (templates.length === 0) {
      console.log('NO TEMPLATES FOUND!');
    } else {
      templates.forEach((t, idx) => {
        console.log(`\n[${idx + 1}] Template: ${t.name}`);
        console.log(`    Program Type: ${t.program_type}`);
        console.log(`    Body Length: ${t.body_length}`);
        if (t.body_length === 0 || !t.body) {
          console.log(`    Body: [EMPTY!]`);
        } else {
          console.log(`    Body Preview: ${t.body.substring(0, 200)}...`);
        }
      });
    }
    
    console.log('\n=== PROGRAM TYPES ===');
    const [types] = await conn.query('SELECT id, Programtyp FROM programtype LIMIT 10');
    if (types.length === 0) {
      console.log('NO PROGRAM TYPES!');
    } else {
      types.forEach(t => {
        console.log(`  ${t.id}: ${t.Programtyp}`);
      });
    }
    
    console.log('\n=== SAMPLE PRAGRAM ===');
    const [programs] = await conn.query('SELECT id, Sn, SenderName, programtyp FROM pragram LIMIT 1');
    if (programs.length > 0) {
      console.log(`Found program: ${programs[0].SenderName} (Sn: ${programs[0].Sn})`);
      console.log(`Program Type ID: ${programs[0].programtyp}`);
    }
    
    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
