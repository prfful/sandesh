/**
 * Add columns for second signature support to lettertemplate table
 * Usage: node add-second-signature-columns.js
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function addSecondSignatureColumns() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected successfully!\n');

    // Check current schema
    console.log('Current lettertemplate schema:');
    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log(columns.map(col => `  - ${col.Field} (${col.Type})`).join('\n'));
    console.log('\n');

    // Define columns to add
    const columnsToAdd = [
      {
        name: 'signature_label',
        definition: 'VARCHAR(255) DEFAULT NULL',
        description: 'Label text for first signature'
      },
      {
        name: 'signature2_url',
        definition: 'VARCHAR(500) DEFAULT NULL',
        description: 'Path to second signature image'
      },
      {
        name: 'signature2_x',
        definition: 'DECIMAL(10,2) DEFAULT 130.00',
        description: 'X position of second signature (mm)'
      },
      {
        name: 'signature2_y',
        definition: 'DECIMAL(10,2) DEFAULT 250.00',
        description: 'Y position of second signature (mm)'
      },
      {
        name: 'signature2_width',
        definition: 'DECIMAL(10,2) DEFAULT 40.00',
        description: 'Width of second signature (mm)'
      },
      {
        name: 'signature2_height',
        definition: 'DECIMAL(10,2) DEFAULT 20.00',
        description: 'Height of second signature (mm)'
      },
      {
        name: 'signature2_label',
        definition: 'VARCHAR(255) DEFAULT NULL',
        description: 'Label text for second signature'
      },
      {
        name: 'signature2_lock_aspect',
        definition: 'BOOLEAN DEFAULT TRUE',
        description: 'Lock aspect ratio for second signature'
      },
      {
        name: 'signature2_lock_position',
        definition: 'BOOLEAN DEFAULT FALSE',
        description: 'Lock position for second signature'
      }
    ];

    // Add each column if it doesn't exist
    for (const col of columnsToAdd) {
      const exists = columns.some(c => c.Field === col.name);
      
      if (exists) {
        console.log(`✓ Column '${col.name}' already exists - skipping`);
      } else {
        console.log(`+ Adding column '${col.name}' - ${col.description}`);
        const sql = `ALTER TABLE lettertemplate ADD COLUMN ${col.name} ${col.definition}`;
        await connection.query(sql);
        console.log(`  ✓ Added successfully`);
      }
    }

    console.log('\n');

    // Show updated schema
    console.log('Updated lettertemplate schema:');
    const [updatedColumns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log(updatedColumns.map(col => `  - ${col.Field} (${col.Type})`).join('\n'));

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run migration
addSecondSignatureColumns()
  .then(() => {
    console.log('\n🎉 All done! You can now implement dual signature support in the UI.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
