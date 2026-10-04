import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkTemplates() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    console.log('Checking lettertemplate table...\n');
    
    const [templates] = await connection.query('SELECT id, name, program_type, is_default FROM lettertemplate');
    
    if (templates.length === 0) {
      console.log('❌ NO TEMPLATES FOUND in database');
    } else {
      console.log(`✅ Found ${templates.length} template(s):\n`);
      templates.forEach((t, idx) => {
        console.log(`${idx + 1}. ID: ${t.id}`);
        console.log(`   Name: ${t.name}`);
        console.log(`   Type: ${t.program_type}`);
        console.log(`   Default: ${t.is_default ? 'Yes' : 'No'}\n`);
      });
    }

    console.log('---\nChecking row count and table size...');
    const [countResult] = await connection.query('SELECT COUNT(*) as count FROM lettertemplate');
    const [sizeResult] = await connection.query("SELECT data_length FROM information_schema.TABLES WHERE table_name='lettertemplate' AND table_schema=DATABASE()");
    
    console.log(`Total rows: ${countResult[0].count}`);
    console.log(`Table size: ${sizeResult[0]?.data_length || 'N/A'} bytes\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTemplates();
