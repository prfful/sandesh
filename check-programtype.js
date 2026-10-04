require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkProgramType() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('--- COLUMNS IN programtype TABLE ---');
    const [columns] = await connection.query('SHOW COLUMNS FROM programtype');
    columns.forEach(col => {
      console.log(`${col.Field} - ${col.Type} - ${col.Null} - ${col.Key} - ${col.Default}`);
    });

    console.log('\n--- SAMPLE DATA ---');
    const [rows] = await connection.query('SELECT * FROM programtype LIMIT 10');
    console.log(JSON.stringify(rows, null, 2));

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkProgramType();
