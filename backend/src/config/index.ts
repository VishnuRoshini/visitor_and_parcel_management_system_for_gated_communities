import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // =========================
  // Server Configuration
  // =========================
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // =========================
  // Database Configuration
  // =========================
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'visitor_parcel_management',
  },

  // =========================
  // CORS Configuration
  // =========================
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',

  // =========================
  // Session Configuration
  // =========================
  sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',

  // =========================
  // VISITOR STATUS FLOW ✅ FIXED
  // =========================
  visitorStatusFlow: {
    NEW: ['WAITING', 'APPROVED', 'REJECTED'], // ✅ DIRECT APPROVE ALLOWED
    WAITING: ['APPROVED', 'REJECTED'],
    APPROVED: ['ENTERED'],
    REJECTED: [],
    ENTERED: ['EXITED'],
    EXITED: [],
  } as Record<string, string[]>,

  // =========================
  // PARCEL STATUS FLOW
  // =========================
  parcelStatusFlow: {
    RECEIVED: ['ACKNOWLEDGED'],
    ACKNOWLEDGED: ['COLLECTED'],
    COLLECTED: [],
  } as Record<string, string[]>,
};

export default config;
