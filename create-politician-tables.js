import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function ensureTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sandesh_data',
  });

  try {
    console.log('Checking/creating politician tables...');

    // Helper: check if table exists
    const tableExists = async (name) => {
      const [rows] = await connection.query('SHOW TABLES LIKE ?', [name]);
      return rows && rows.length > 0;
    };

    // Politician_Type → politician_type
    if (!(await tableExists('politician_type'))) {
      console.log('Creating table: politician_type');
      await connection.query(`
        CREATE TABLE politician_type (
          id INT PRIMARY KEY AUTO_INCREMENT,
          Designation VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('✓ Created politician_type');
    } else {
      console.log('✓ politician_type exists');
    }

    // Politician
    if (!(await tableExists('politician'))) {
      console.log('Creating table: politician');
      await connection.query(`
        CREATE TABLE politician (
          id INT PRIMARY KEY AUTO_INCREMENT,
          Name VARCHAR(255) NOT NULL,
          Designation INT,
          Address TEXT,
          Area TINYINT(1) DEFAULT 0,
          Village_City VARCHAR(255),
          Block VARCHAR(255),
          Mobile VARCHAR(10),
          DOB DATE,
          DOA DATE,
          Booth_No INT,
          AutoAllow TINYINT(1) DEFAULT 0,
          CONSTRAINT fk_politician_designation FOREIGN KEY (Designation)
            REFERENCES politician_type(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('✓ Created politician');
    } else {
      console.log('✓ politician exists');
    }

    // WhatsApp delivery log
    if (!(await tableExists('whatsapp_log'))) {
      console.log('Creating table: whatsapp_log');
      await connection.query(`
        CREATE TABLE whatsapp_log (
          id INT PRIMARY KEY AUTO_INCREMENT,
          person_id INT,
          type VARCHAR(32), -- bulk | birthday | anniversary
          message TEXT,
          status VARCHAR(32), -- success | failed
          response TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_person_type (person_id, type),
          CONSTRAINT fk_log_politician FOREIGN KEY (person_id)
            REFERENCES politician(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('✓ Created whatsapp_log');
    } else {
      console.log('✓ whatsapp_log exists');
    }

    console.log('\n✅ Schema ready');
  } catch (err) {
    console.error('❌ Error ensuring tables:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

ensureTables();
