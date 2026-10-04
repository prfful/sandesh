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

console.log('--- LetterSettings Table Structure ---');
const [columns] = await connection.query('DESCRIBE lettersettings');
console.log(columns);

console.log('\n--- LetterSettings Table Data ---');
const [rows] = await connection.query('SELECT * FROM lettersettings');
console.log(`Found ${rows.length} records:`);
rows.forEach(row => console.log(row));

await connection.end();
