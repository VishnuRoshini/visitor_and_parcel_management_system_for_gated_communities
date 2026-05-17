-- Visitor & Parcel Management System
-- Database Migration Script: Add Authentication Columns
-- Run this AFTER the initial schema if you have existing data

USE visitor_parcel_management;

-- Add new columns to users table
ALTER TABLE users 
  ADD COLUMN email VARCHAR(100) UNIQUE AFTER name,
  ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT '' AFTER email,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER contact_info,
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Update existing users with email (based on name)
UPDATE users SET 
  email = CONCAT(LOWER(REPLACE(SUBSTRING_INDEX(name, ' ', 1), ' ', '')), '@vpm.com'),
  password = '$2b$10$8KzO9xZn8Qw.X1Y2Z3A4beMnOpQrStUvWxYz0123456789abcdefghi'
WHERE email IS NULL;

-- The password above is a placeholder. You'll need to update it with proper hashes.
-- Use the setup-passwords.ts script to generate and update proper password hashes.
