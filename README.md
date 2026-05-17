# Visitor & Parcel Management System

> ✅ **Status: Successfully Developed and Implemented**
>
> This project is a fully developed and functional web-based application for gated community management with real-time visitor, parcel, and complaint/query handling features.

A comprehensive, production-ready management system for gated communities built with **Angular 16**, **Node.js + Express + TypeScript**, and **MySQL**.

![Status](https://img.shields.io/badge/Status-Completed-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-16.2.0-red.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue.svg)

---

## 📋 Table of Contents

* [Features](#-features)
* [Tech Stack](#-tech-stack)
* [Architecture](#-architecture)
* [Database Design](#-database-design)
* [Installation](#-installation)
* [Running the Application](#-running-the-application)
* [API Documentation](#-api-documentation)
* [User Roles](#-user-roles)
* [Status Flow](#-status-flow)
* [Screenshots](#-screenshots)
* [Project Structure](#-project-structure)

---

# ✨ Features

## Core Functionality

* **Visitor Management**: Log, track, and manage visitor entries with approval workflow
* **Parcel Management**: Track parcels from receipt to collection
* **Query / Complaint Management**: Residents can raise complaints or queries, and administrators can manage and resolve them
* **Real-time Notifications**: Socket.IO powered instant updates
* **Role-based Access Control**: Admin, Security Guard, and Resident roles
* **Dashboard Analytics**: Statistics and recent activity tracking

---

# 🔐 Security Features

* **Two-Factor Authentication (2FA)** using TOTP
* **JWT Authentication with Refresh Tokens**
* **Rate Limiting** against brute-force attacks
* **Strong Password Validation**
* **Security PIN** for password recovery
* **Audit Logging**
* **Account Lockout Protection**

---

# 🛠 Tech Stack

## Frontend

* Angular 16
* Angular Material
* RxJS
* Socket.IO Client
* SCSS

## Backend

* Node.js
* Express.js
* TypeScript
* MySQL2
* Socket.IO
* JWT Authentication
* bcrypt
* express-validator

## Database

* MySQL 8.0

---

# 🏗 Architecture

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Angular SPA    │────▶│  Express API    │────▶│    MySQL DB     │
│  (Frontend)     │     │  (Backend)      │     │                 │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        │
        └──────────── Socket.IO ──────────────
```

---

# 💾 Database Design

The system uses multiple tables for secure and efficient management of visitors, parcels, users, and complaints/queries.

## Main Tables

* Users
* Records
* Refresh Tokens
* Audit Logs
* OTP Codes
* Login Attempts
* Queries / Complaints

---

# 🚀 Installation

## Prerequisites

* Node.js 18+
* MySQL 8.0+
* Angular CLI
* Git

## Clone Repository

```bash
git clone https://github.com/your-repository-link.git
cd visitor-parcel-management-system
```

---

# 🏃 Running the Application

## Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on:

```text
http://localhost:3001
```

## Frontend

```bash
cd frontend
npm install
ng serve
```

Frontend runs on:

```text
http://localhost:4200
```

---

# 📚 API Documentation

## Authentication APIs

* Login
* Logout
* Refresh Token
* Change Password
* Enable / Disable 2FA

## Visitor APIs

* Add Visitor
* Update Visitor Status
* View Visitors

## Parcel APIs

* Add Parcel
* Update Parcel Status
* View Parcels

## Query / Complaint APIs

* Raise Complaint / Query
* View Complaint History
* Update Complaint Status
* Resolve Complaints

---

# 👥 User Roles

## Admin

* Manage all users
* Monitor visitors and parcels
* Manage complaints/queries
* View dashboard statistics

## Security Guard

* Add visitor entries
* Add parcel records
* Update statuses

## Resident

* Approve/reject visitors
* View parcel updates
* Raise complaints and queries
* Track complaint status

---

# 🔄 Status Flow

## Visitor Flow

```text
NEW → WAITING → APPROVED / REJECTED
                    ↓
               ENTERED → EXITED
```

## Parcel Flow

```text
RECEIVED → ACKNOWLEDGED → COLLECTED
```

## Complaint / Query Flow

```text
PENDING → IN_PROGRESS → RESOLVED
```

---

# 📁 Project Structure

```text
visitor-parcel-management/
│
├── backend/
├── frontend/
├── database/
├── README.md
└── package.json
```

---

# 🔐 Test Credentials

| Role     | Email                                     | Password    |
| -------- | ----------------------------------------- | ----------- |
| Admin    | [admin@vpm.com](mailto:admin@vpm.com)     | password123 |
| Security | [guard1@vpm.com](mailto:guard1@vpm.com)   | password123 |
| Resident | [roshini@vpm.com](mailto:roshini@vpm.com) | password123 |

---

# 📝 License

This project is licensed under the MIT License.

---

# 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to GitHub
5. Create a Pull Request

---

⭐ Star this repository if you found it useful!
