-- Visitor & Parcel Management System
-- Database Schema for Capstone Project

CREATE DATABASE IF NOT EXISTS visitor_parcel_management;
USE visitor_parcel_management;

-- =====================================================
-- TABLE 1: users
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    security_pin VARCHAR(255) DEFAULT NULL,
    password_changed_count INT DEFAULT 0,
    must_change_password BOOLEAN DEFAULT FALSE,
    role ENUM('RESIDENT', 'SECURITY', 'ADMIN') NOT NULL,
    contact_info VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE 2: records
-- =====================================================
CREATE TABLE records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    security_guard_id INT NOT NULL,
    type ENUM('VISITOR', 'PARCEL') NOT NULL,
    name VARCHAR(100) NOT NULL,
    purpose_or_description VARCHAR(500) NOT NULL,
    media_url VARCHAR(500),
    vehicle_details VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (security_guard_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- SEED DATA (Default password for all users: "password123")
-- Hash generated using bcrypt with 10 rounds
-- =====================================================
INSERT INTO users (name, email, password, role, contact_info) VALUES
('Admin User', 'admin@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'ADMIN', '9999999999'),
('Srinivas', 'srinivas@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'RESIDENT', '9876543209'),
('Karthik', 'karthik@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'RESIDENT', '9876543210'),
('Pradha', 'prabhu@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'RESIDENT', '9876543211'),
('Roshini', 'roshini@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'RESIDENT', '9876543212'),
('Guard One', 'guard1@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'SECURITY', '9123456789'),
('Guard Two', 'guard2@vpm.com', '$2b$10$nnhGq5rHqifDedhir0tK4.wdeLSW0VrhNuFqUlRfH.WXvqUG8DAkG', 'SECURITY', '9123456780');
