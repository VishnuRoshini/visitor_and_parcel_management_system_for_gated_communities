# Visitor & Parcel Management System

> ⚠️ **Status: Under Development / Testing**
> 
> This project is currently under active development and testing. Features may be incomplete or subject to change.

A comprehensive, production-ready management system for gated communities built with **Angular 16**, **Node.js + Express + TypeScript**, and **MySQL**.

![Status](https://img.shields.io/badge/Status-Under%20Development-yellow.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-16.2.0-red.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue.svg)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Design](#-database-design)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [User Roles](#-user-roles)
- [Status Flow](#-status-flow)
- [Screenshots](#-screenshots)
- [Project Structure](#-project-structure)

## ✨ Features

### Core Functionality
- **Visitor Management**: Log, track, and manage visitor entries with approval workflow
- **Parcel Management**: Track parcels from receipt to collection
- **Real-time Notifications**: Socket.IO powered instant updates
- **Role-based Access Control**: Admin, Security Guard, and Resident roles
- **Dashboard Analytics**: Statistics and recent activity tracking

### 🔐 Security Features
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA with QR code setup
- **JWT with Refresh Tokens**: Secure token rotation with 15-min access tokens and 7-day refresh tokens
- **Rate Limiting**: Protection against brute-force attacks on login and password reset
- **Strong Password Validation**: Minimum 8 characters with complexity requirements and strength indicator
- **Security PIN**: 6-digit PIN for password recovery verification
- **Audit Logging**: Comprehensive logging of all security-sensitive actions
- **Account Lockout**: Automatic lockout after multiple failed login attempts
- <!-- First-Time Password Setup: Forced password change on first login (DISABLED) -->

### Technical Highlights
- Clean architecture with separation of concerns
- Type-safe codebase with TypeScript
- Input validation and error handling
- Responsive Material Design UI
- Status transition validation
- Lazy-loaded Angular modules

## 🛠 Tech Stack

### Frontend
- **Angular 16** - Modern web framework
- **Angular Material** - UI component library
- **RxJS** - Reactive programming
- **Socket.IO Client** - Real-time communication
- **SCSS** - Styling with variables and mixins

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MySQL2** - Database driver with pooling
- **Socket.IO** - WebSocket server
- **JWT** - JSON Web Tokens for authentication
- **bcrypt** - Password hashing
- **speakeasy** - TOTP-based 2FA
- **qrcode** - QR code generation for 2FA setup
- **express-rate-limit** - Rate limiting middleware
- **express-validator** - Input validation

### Database
- **MySQL 8.0** - Relational database

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Angular SPA    │────▶│  Express API    │────▶│    MySQL DB     │
│  (Frontend)     │     │  (Backend)      │     │                 │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        └───────────────────────┘
              Socket.IO
           (Real-time Events)
```

## 💾 Database Design

The system uses **6 tables** for comprehensive visitor/parcel management with security features:

### Core Tables

#### 1. Users Table
Stores all system users (Admins, Security Guards, Residents)
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,              -- bcrypt hashed
    security_pin VARCHAR(255) DEFAULT NULL,      -- 6-digit PIN for password reset
    password_changed_count INT DEFAULT 0,        -- Track password changes
    must_change_password BOOLEAN DEFAULT TRUE,   -- Force password change on first login
    role ENUM('RESIDENT', 'SECURITY', 'ADMIN') NOT NULL,
    contact_info VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,    -- 2FA status
    two_factor_secret VARCHAR(255) NULL,         -- TOTP secret key
    failed_login_attempts INT DEFAULT 0,         -- For account lockout
    locked_until TIMESTAMP NULL,                 -- Account lockout timestamp
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. Records Table
Stores both visitor and parcel entries
```sql
CREATE TABLE records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,                    -- Which resident this is for
    security_guard_id INT NOT NULL,              -- Which guard logged this
    type ENUM('VISITOR', 'PARCEL') NOT NULL,     -- Entry type
    name VARCHAR(100) NOT NULL,                  -- Visitor name or parcel sender
    purpose_or_description VARCHAR(500) NOT NULL,
    media_url VARCHAR(500),                      -- Photo URL (optional)
    vehicle_details VARCHAR(100),                -- Vehicle info (optional)
    status VARCHAR(20) NOT NULL,                 -- Current status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (resident_id) REFERENCES users(id),
    FOREIGN KEY (security_guard_id) REFERENCES users(id)
);
```

### Security Tables

#### 3. Refresh Tokens Table
Stores JWT refresh tokens for secure token rotation
```sql
CREATE TABLE refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 4. Audit Logs Table
Tracks all security-sensitive actions
```sql
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,        -- e.g., 'LOGIN', 'PASSWORD_CHANGE'
    entity_type VARCHAR(50) NOT NULL,    -- e.g., 'USER', 'VISITOR'
    entity_id INT NULL,
    details JSON NULL,                   -- Additional context
    ip_address VARCHAR(45) NULL,
    status ENUM('SUCCESS', 'FAILURE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. OTP Codes Table
Stores one-time passwords for 2FA
```sql
CREATE TABLE otp_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code VARCHAR(10) NOT NULL,
    type ENUM('LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFY') NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 6. Login Attempts Table
Tracks login attempts for rate limiting
```sql
CREATE TABLE login_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Database Schema Diagram
```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │    records      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ name            │  │    │ resident_id (FK)│──┐
│ email           │  │    │ security_id (FK)│──┤
│ password        │  │    │ type            │  │
│ security_pin    │  │    │ name            │  │
│ role            │  │    │ purpose         │  │
│ two_factor_*    │  │    │ status          │  │
│ ...             │  │    │ created_at      │  │
└─────────────────┘  │    └─────────────────┘  │
         ▲           │                         │
         │           └─────────────────────────┘
         │
┌────────┴────────┐   ┌─────────────────┐   ┌─────────────────┐
│ refresh_tokens  │   │   audit_logs    │   │  login_attempts │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ id (PK)         │   │ id (PK)         │   │ id (PK)         │
│ user_id (FK)    │   │ user_id (FK)    │   │ email           │
│ token           │   │ action          │   │ ip_address      │
│ expires_at      │   │ entity_type     │   │ success         │
│ revoked         │   │ details (JSON)  │   │ created_at      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 🚀 Installation

### Prerequisites
- **Node.js 18+** - Download from https://nodejs.org
- **MySQL 8.0+** - Download from https://dev.mysql.com/downloads/mysql/
- **Git** - Download from https://git-scm.com
- **Angular CLI** - Install via `npm install -g @angular/cli`

### 1. Clone the Repository
```bash
git clone https://github.com/Srinivas-18/visitor-parcel-management-system.git
cd visitor-parcel-management-system
```

### 2. Database Setup
```bash
# Login to MySQL
mysql -u root -p

# Run the schema file (creates database and seed data)
source database/schema.sql

# Run the security features migration (adds security tables)
source database/migration-security-features.sql

# Exit MySQL
exit
```

### 3. Backend Setup
```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create environment file
# On Windows:
copy .env.example .env
# On Mac/Linux:
cp .env.example .env

# Edit .env file with your MySQL credentials:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_mysql_password
# DB_NAME=visitor_parcel_management
```

### 4. Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# If Angular CLI is not installed globally:
npm install -g @angular/cli
```

## 🏃 Running the Application

### Development Mode

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```
✅ Server runs on **http://localhost:3001**

**Terminal 2 - Start Frontend:**
```bash
cd frontend
ng serve
```
✅ App runs on **http://localhost:4200**

### Quick Start (Both Servers)
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend (open new terminal)
cd frontend && ng serve
```

### Access the Application
1. Open your browser and go to **http://localhost:4200**
2. Login with test credentials (see below)
3. On first login, you'll be prompted to set a new password and security PIN

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
ng build --configuration production
# Deploy dist/ folder to your web server
```

## 📚 API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (revoke refresh token) |
| POST | `/api/auth/logout-all` | Logout from all devices |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/residents` | Get all residents (for Security) |
| POST | `/api/auth/setup-password` | First-time password setup with PIN |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/can-change-password` | Check password change eligibility |
| POST | `/api/auth/enable-2fa` | Enable 2FA (returns QR code) |
| POST | `/api/auth/verify-2fa` | Verify 2FA code during login |
| POST | `/api/auth/disable-2fa` | Disable 2FA |
| GET | `/api/auth/2fa-status` | Get 2FA status |

### Visitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/visitors` | Get all visitors (Security) |
| GET | `/api/visitors/pending` | Get pending approvals (Resident) |
| POST | `/api/visitors` | Create visitor entry |
| PUT | `/api/visitors/:id/status` | Update visitor status |

### Parcels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parcels` | Get all parcels (Security) |
| GET | `/api/parcels/resident` | Get resident's parcels |
| POST | `/api/parcels` | Create parcel entry |
| PUT | `/api/parcels/:id/status` | Update parcel status |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |

## 👥 User Roles

### Admin
- View dashboard with statistics
- Access all visitor and parcel logs
- System overview and monitoring

### Security Guard
- Log new visitors and parcels
- Update visitor status (Entry/Exit)
- Mark parcels as collected
- View all records

### Resident
- Approve/Reject visitor requests
- Acknowledge and collect parcels
- View personal visitor history

## 🔄 Status Flow

### Visitor Status Flow
```
NEW → WAITING → APPROVED/REJECTED
                    ↓
               ENTERED → EXITED
```

### Parcel Status Flow
```
RECEIVED → ACKNOWLEDGED → COLLECTED
```

## 📸 Screenshots

### Login Page
Clean, professional login interface with role-based redirection.

### Admin Dashboard
Statistics overview with visitor/parcel counts and recent activity.

### Security - Visitor Log
Table view with search, pagination, and quick status actions.

### Resident - Approvals
Card-based pending approvals with approve/reject actions.

## 📁 Project Structure

```
visitor-parcel-management/
├── database/
│   └── schema.sql              # Database schema with seed data
│
├── backend/
│   ├── src/
│   │   ├── config/             # Database & app configuration
│   │   ├── types/              # TypeScript interfaces
│   │   ├── utils/              # Helper functions
│   │   ├── middlewares/        # Auth, error, validation
│   │   ├── models/             # Database models
│   │   ├── services/           # Business logic
│   │   ├── controllers/        # Route handlers
│   │   ├── routes/             # API routes
│   │   ├── socket/             # Socket.IO setup
│   │   └── app.ts              # Express application
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/           # Services, guards, models
│   │   │   ├── shared/         # Shared components & modules
│   │   │   ├── auth/           # Login module
│   │   │   ├── admin/          # Admin dashboard
│   │   │   ├── visitor/        # Visitor management
│   │   │   ├── parcel/         # Parcel management
│   │   │   └── app.module.ts   # Root module
│   │   ├── environments/       # Environment configs
│   │   └── styles.scss         # Global styles
│   ├── angular.json
│   └── package.json
│
└── README.md
```

## 🔐 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@vpm.com | password123 |
| Security | guard1@vpm.com | password123 |
| Security | guard2@vpm.com | password123 |
| Resident | srinivas@vpm.com | password123 |
| Resident | karthik@vpm.com | password123 |
| Resident | pradha@vpm.com | password123 |
| Resident | roshini@vpm.com | password123 |

> **Note**: On first login, users are required to set up a new password and a 6-digit security PIN.
>
> **Update**: First-time password setup is no longer required. You can log in directly with the credentials above.

## ℹ️ Other Notes

- The favicon.ico file is optional. If you remove it, you may see a 404 error in the browser console, but it will not affect application functionality.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

⭐ Star this repository if you found it helpful!
