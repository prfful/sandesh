import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.join(__dirname, '.env.local');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : path.join(__dirname, '.env') });

async function addInvitationCardColumn() {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set before running this migration.');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM pragram');
    if (columns.some((column) => column.Field === 'invitation_card_url')) {
      console.log('pragram.invitation_card_url already exists.');
      return;
    }

    await connection.query(
      'ALTER TABLE pragram ADD COLUMN invitation_card_url VARCHAR(1024) NULL DEFAULT NULL'
    );
    console.log('Added pragram.invitation_card_url.');
  } finally {
    await connection.end();
  }
}

addInvitationCardColumn().catch((error) => {
  console.error('Failed to add invitation-card column:', error.message);
  process.exitCode = 1;
});
