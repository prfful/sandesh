// Script to create an initial admin user if one doesn't exist
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

dotenv.config();

async function createInitialAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Connected to database');

    // Check if any admin user exists
    const [admins] = await connection.query(
      "SELECT * FROM operator WHERE role = 'admin' LIMIT 1"
    );

    if (admins.length > 0) {
      console.log('\n✓ Admin user already exists:');
      console.log(`  Email: ${admins[0].email}`);
      console.log(`  Name: ${admins[0].name}`);
      console.log('\nNo need to create a new admin.');
      return;
    }

    // Create admin user
    const adminEmail = 'admin@sandesh.local';
    const adminPassword = 'admin123'; // Change this in production!
    const adminName = 'एडमिन';

    // Hash password
    const passwordHash = createHash('sha256').update(adminPassword).digest('hex');

    // Generate UUID
    const adminId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    console.log('\n✅ Creating initial admin user...');
    await connection.query(
      `INSERT INTO operator (id, name, email, password_hash, role, is_active, created_date)
       VALUES (?, ?, ?, ?, 'admin', 1, NOW())`,
      [adminId, adminName, adminEmail, passwordHash]
    );

    console.log('✅ Admin user created successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANT: Please change this password after first login!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createInitialAdmin();
