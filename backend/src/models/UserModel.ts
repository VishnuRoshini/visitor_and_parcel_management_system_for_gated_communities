import { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '../types';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';

interface UserRow extends User, RowDataPacket {}

const SALT_ROUNDS = 10;

export class UserModel {
  // Find user by ID (excludes password and PIN by default)
  static async findById(id: number, includeSecrets = false): Promise<User | null> {
    const fields = includeSecrets 
      ? '*' 
      : 'id, name, email, role, contact_info, is_active, must_change_password, password_changed_count, created_at, updated_at';
    
    const rows = await db.query<UserRow[]>(
      `SELECT ${fields} FROM users WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return rows[0];
  }

  // Find user by email (includes password for login verification)
  static async findByEmail(email: string): Promise<User | null> {
    const rows = await db.query<UserRow[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (rows.length === 0) return null;
    return rows[0];
  }

  // Check if email exists
  static async emailExists(email: string, excludeUserId?: number): Promise<boolean> {
    let query = 'SELECT id FROM users WHERE email = ?';
    const params: (string | number)[] = [email];
    
    if (excludeUserId) {
      query += ' AND id != ?';
      params.push(excludeUserId);
    }
    
    const rows = await db.query<UserRow[]>(query, params);
    return rows.length > 0;
  }

  // Get all users by role
  static async findByRole(role: UserRole): Promise<User[]> {
    const rows = await db.query<UserRow[]>(
      'SELECT id, name, email, role, contact_info, is_active, must_change_password, password_changed_count, created_at, updated_at FROM users WHERE role = ? AND is_active = TRUE ORDER BY name',
      [role]
    );
    
    return rows;
  }

  // Get all residents (commonly used for dropdowns)
  static async getAllResidents(): Promise<User[]> {
    return this.findByRole('RESIDENT');
  }

  // Get all security guards
  static async getAllSecurityGuards(): Promise<User[]> {
    return this.findByRole('SECURITY');
  }

  // Get all users (admin view)
  static async getAll(): Promise<User[]> {
    const rows = await db.query<UserRow[]>(
      'SELECT id, name, email, role, contact_info, is_active, must_change_password, password_changed_count, created_at, updated_at FROM users ORDER BY role, name'
    );
    
    return rows;
  }

  // Create a new user (Admin only)
  static async create(userData: CreateUserRequest): Promise<User> {
    // Check if email already exists
    if (await this.emailExists(userData.email)) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

    const result = await db.execute(
      `INSERT INTO users (name, email, password, role, contact_info, must_change_password, password_changed_count) VALUES (?, ?, ?, ?, ?, FALSE, 0)`,
      [
        userData.name,
        userData.email,
        hashedPassword,
        userData.role,
        userData.contact_info || null,
      ]
    );

    const newUser = await this.findById(result.insertId);
    if (!newUser) throw new Error('Failed to create user');
    
    return newUser;
  }

  // Update user
  static async update(id: number, userData: UpdateUserRequest): Promise<User> {
    // Check if email is being updated and if it already exists
    if (userData.email && await this.emailExists(userData.email, id)) {
      throw new ConflictError('Email already registered');
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (userData.name) {
      fields.push('name = ?');
      values.push(userData.name);
    }
    if (userData.email) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.contact_info !== undefined) {
      fields.push('contact_info = ?');
      values.push(userData.contact_info);
    }
    if (userData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(userData.is_active);
    }

    if (fields.length === 0) {
      const user = await this.findById(id);
      if (!user) throw new NotFoundError('User not found');
      return user;
    }

    values.push(id);
    await db.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const updatedUser = await this.findById(id);
    if (!updatedUser) throw new NotFoundError('User not found');
    
    return updatedUser;
  }

  // Reset password (Admin only - requires PIN verification)
  static async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundError('User not found');

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await db.execute(
      'UPDATE users SET password = ?, must_change_password = FALSE WHERE id = ?',
      [hashedPassword, id]
    );
  }

  // Verify security PIN
  static async verifySecurityPin(id: number, pin: string): Promise<boolean> {
    const rows = await db.query<UserRow[]>(
      'SELECT security_pin FROM users WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0 || !rows[0].security_pin) return false;
    return bcrypt.compare(pin, rows[0].security_pin);
  }

  // Check if user has PIN set
  static async hasSecurityPin(id: number): Promise<boolean> {
    const rows = await db.query<UserRow[]>(
      'SELECT security_pin FROM users WHERE id = ?',
      [id]
    );
    return rows.length > 0 && rows[0].security_pin !== null;
  }

  // First-time password setup with PIN
  static async setupPassword(id: number, newPassword: string, securityPin: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundError('User not found');

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(securityPin)) {
      throw new BadRequestError('Security PIN must be exactly 6 digits');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const hashedPin = await bcrypt.hash(securityPin, SALT_ROUNDS);
    
    await db.execute(
      'UPDATE users SET password = ?, security_pin = ?, must_change_password = FALSE, password_changed_count = password_changed_count + 1 WHERE id = ?',
      [hashedPassword, hashedPin, id]
    );
  }

  // Self password change (increments counter)
  static async changePassword(id: number, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundError('User not found');

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await db.execute(
      'UPDATE users SET password = ?, must_change_password = FALSE, password_changed_count = password_changed_count + 1 WHERE id = ?',
      [hashedPassword, id]
    );
  }

  // Check if user can change their own password
  static canChangePassword(user: User): { canChange: boolean; reason?: string } {
    // Admin can always change
    if (user.role === 'ADMIN') {
      return { canChange: true };
    }

    // If user hasn't completed initial setup (must_change_password is TRUE), they must setup with PIN first
    if (user.must_change_password) {
      return {
        canChange: false,
        reason: 'Please complete the initial password setup with security PIN first.'
      };
    }
    
    // Residents and Security can only change once (after initial setup)
    if (user.password_changed_count >= 1) {
      return { 
        canChange: false, 
        reason: 'You have already changed your password once. Please contact the administrator to reset your password.' 
      };
    }
    
    return { canChange: true };
  }

  // Verify password
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Deactivate user (soft delete)
  static async deactivate(id: number): Promise<void> {
    const result = await db.execute(
      'UPDATE users SET is_active = FALSE WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('User not found');
    }
  }

  // Activate user
  static async activate(id: number): Promise<void> {
    const result = await db.execute(
      'UPDATE users SET is_active = TRUE WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('User not found');
    }
  }

  // Delete user (hard delete - use with caution)
  static async delete(id: number): Promise<void> {
    const result = await db.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('User not found');
    }
  }
}

export default UserModel;
