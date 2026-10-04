import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log('Connected to DB');

  const [tables] = await connection.query('SHOW TABLES');
  const hasMandal = tables.some(t => Object.values(t)[0] === 'mandal');
  if (!hasMandal) {
    await connection.query(`
      CREATE TABLE mandal (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created mandal table');
  } else {
    console.log('✓ mandal table exists');
  }

  const [cols] = await connection.query('SHOW COLUMNS FROM politician');
  const hasMandalCol = cols.some(c => c.Field === 'Mandal');
  if (!hasMandalCol) {
    await connection.query('ALTER TABLE politician ADD COLUMN Mandal INT NULL');
    console.log('✓ Added Mandal column to politician');
  } else {
    console.log('✓ Mandal column exists in politician');
  }

  await connection.end();
  console.log('✅ Schema updated (mandal + politician.Mandal)');
})();