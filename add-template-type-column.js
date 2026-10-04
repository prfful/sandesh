import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addTemplateTypeColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    console.log('Checking lettertemplate table for template_type column...');

    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    const hasTemplateType = columns.some((col) => col.Field === 'template_type');

    if (!hasTemplateType) {
      await connection.query(
        "ALTER TABLE lettertemplate ADD COLUMN template_type VARCHAR(20) NOT NULL DEFAULT 'utility'"
      );
      console.log('Added template_type column at table end.');
    } else {
      console.log('template_type column already exists.');
    }

    // Auto-classify existing wishes templates as text.
    const [result] = await connection.query(
      "UPDATE lettertemplate SET template_type = 'text' WHERE LOWER(COALESCE(program_type, '')) IN ('birthday', 'anniversary', 'simple_text')"
    );
    console.log(`Updated existing wishes rows to text: ${result.affectedRows}`);

    const [finalColumns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log('Final columns:');
    finalColumns.forEach((col) => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

    console.log('Done.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

addTemplateTypeColumn();
