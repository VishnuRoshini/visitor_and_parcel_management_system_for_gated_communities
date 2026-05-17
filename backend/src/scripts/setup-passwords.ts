/**
 * Setup Script: Generate password hashes and update database
 * Run with: npx ts-node src/scripts/setup-passwords.ts
 */

import bcrypt from 'bcrypt';
import db from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

const DEFAULT_PASSWORD = 'password123';
const SALT_ROUNDS = 10;

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string | null;
}

interface ColumnRow extends RowDataPacket {
  Field: string;
}

interface UpdatedUserRow extends RowDataPacket {
  name: string;
  email: string;
  role: string;
}

async function setupPasswords() {
  console.log('🔐 Setting up passwords for all users...\n');
  
  try {
    // Generate password hash
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    console.log(`Generated hash for "${DEFAULT_PASSWORD}":`);
    console.log(hashedPassword);
    console.log('');

    // Check if email column exists
    const columns = await db.query<ColumnRow[]>(
      "SHOW COLUMNS FROM users LIKE 'email'"
    );

    if (columns.length === 0) {
      console.log('Adding email, password, is_active, updated_at columns...');
      
      // Add columns
      await db.execute(`
        ALTER TABLE users 
          ADD COLUMN email VARCHAR(100) UNIQUE AFTER name,
          ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT '' AFTER email,
          ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER contact_info,
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
      `);
      console.log('✅ Columns added successfully\n');
    }

    // Get all users
    const users = await db.query<UserRow[]>('SELECT id, name, email FROM users');
    
    console.log(`Found ${users.length} users. Updating...\n`);

    for (const user of users) {
      // Generate email from name if not exists
      const firstName = user.name.split(' ')[0].toLowerCase();
      const email = user.email || `${firstName}@vpm.com`;
      
      await db.execute(
        'UPDATE users SET email = ?, password = ? WHERE id = ?',
        [email, hashedPassword, user.id]
      );
      
      console.log(`✅ Updated user: ${user.name} -> ${email}`);
    }

    console.log('\n🎉 All passwords set to: ' + DEFAULT_PASSWORD);
    console.log('\n📧 Login emails:');
    
    const updatedUsers = await db.query<UpdatedUserRow[]>(
      'SELECT name, email, role FROM users ORDER BY role, name'
    );
    
    for (const u of updatedUsers) {
      console.log(`   ${u.role.padEnd(10)} ${u.name.padEnd(20)} ${u.email}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupPasswords();
