import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  });

  try {
    console.log('Updating lettersettings table schema...');

    // Add design_template column for storing visual designer data
    try {
      await connection.query(`
        ALTER TABLE lettersettings 
        ADD COLUMN design_template TEXT
      `);
      console.log('✅ Added design_template column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  design_template column already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Schema update completed!');

  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

updateSchema();
