import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function verifyAutoIncrement() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    console.log('Checking lettertemplate table schema...\n');

    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log('Current columns:');
    columns.forEach((col) => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Key ? `[${col.Key}]` : ''} ${col.Extra || ''}`);
    });

    const idColumn = columns.find(col => col.Field === 'id');
    if (!idColumn) {
      console.error('\n❌ ERROR: No id column found in lettertemplate table!');
      process.exitCode = 1;
      return;
    }

    const hasAutoIncrement = idColumn.Extra && idColumn.Extra.includes('auto_increment');
    if (!hasAutoIncrement) {
      console.warn('\n⚠️ WARNING: id column does NOT have AUTO_INCREMENT.');
      console.log('Attempting to add AUTO_INCREMENT...');
      
      await connection.query('ALTER TABLE lettertemplate MODIFY id INT AUTO_INCREMENT');
      console.log('✅ AUTO_INCREMENT added to id column.');
    } else {
      console.log('\n✅ id column already has AUTO_INCREMENT.');
    }

    // Verify the change
    const [updatedColumns] = await connection.query('SHOW COLUMNS FROM lettertemplate WHERE Field = "id"');
    if (updatedColumns.length) {
      const updatedIdCol = updatedColumns[0];
      console.log('\nVerified id column:');
      console.log(`- ${updatedIdCol.Field}: ${updatedIdCol.Type} ${updatedIdCol.Key ? `[${updatedIdCol.Key}]` : ''} ${updatedIdCol.Extra || ''}`);
    }

    console.log('\n✅ Done.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

verifyAutoIncrement();
