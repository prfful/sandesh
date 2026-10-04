import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addMissingColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    console.log('Checking lettertemplate table structure...\n');
    const [columns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    const columnNames = columns.map(col => col.Field);
    
    console.log('Existing columns:', columnNames);
    console.log('\n---\n');

    const requiredColumns = [
      { name: 'letterhead_url', type: 'TEXT' },
      { name: 'signature_url', type: 'TEXT' },
      { name: 'letterhead_x', type: 'DECIMAL(10,2)', default: 0 },
      { name: 'letterhead_y', type: 'DECIMAL(10,2)', default: 0 },
      { name: 'letterhead_width', type: 'DECIMAL(10,2)', default: 100 },
      { name: 'letterhead_height', type: 'DECIMAL(10,2)', default: 15 },
      { name: 'letterhead_lock_aspect', type: 'TINYINT(1)', default: 1 },
      { name: 'letterhead_lock_position', type: 'TINYINT(1)', default: 0 },
      { name: 'letterhead_expand_width', type: 'TINYINT(1)', default: 0 },
      { name: 'signature_x', type: 'DECIMAL(10,2)', default: 70 },
      { name: 'signature_y', type: 'DECIMAL(10,2)', default: 75 },
      { name: 'signature_width', type: 'DECIMAL(10,2)', default: 25 },
      { name: 'signature_height', type: 'DECIMAL(10,2)', default: 10 },
      { name: 'signature_lock_aspect', type: 'TINYINT(1)', default: 1 },
      { name: 'signature_lock_position', type: 'TINYINT(1)', default: 0 },
      { name: 'body_content_top_offset_mm', type: 'DECIMAL(10,2)', default: 40 },
      { name: 'signature_bottom_offset_mm', type: 'DECIMAL(10,2)', default: 60 },
      { name: 'font_family', type: 'VARCHAR(255)' },
      { name: 'font_size', type: 'INT', default: 16 },
      { name: 'line_height', type: 'DECIMAL(5,2)', default: 1.90 },
      { name: 'paragraph_left_mm', type: 'DECIMAL(10,2)', default: 5 },
      { name: 'paragraph_right_mm', type: 'DECIMAL(10,2)', default: 5 },
      { name: 'first_line_indent_mm', type: 'DECIMAL(10,2)', default: 0 },
    ];

    for (const col of requiredColumns) {
      if (!columnNames.includes(col.name)) {
        let sql = `ALTER TABLE lettertemplate ADD COLUMN ${col.name} ${col.type}`;
        if (col.default !== undefined) {
          sql += ` DEFAULT ${col.default}`;
        }
        console.log(`Adding column: ${col.name}`);
        await connection.query(sql);
        console.log(`✓ Added ${col.name}\n`);
      } else {
        console.log(`✓ ${col.name} already exists`);
      }
    }

    console.log('\n---\nVerifying final structure...\n');
    const [finalColumns] = await connection.query('SHOW COLUMNS FROM lettertemplate');
    console.log('Final columns:', finalColumns.map(col => `${col.Field} (${col.Type})`).join(', '));
    console.log('\n✅ All required columns are present!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addMissingColumns();
