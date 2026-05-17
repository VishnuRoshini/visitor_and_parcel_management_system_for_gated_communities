import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import config from '../config';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  // Execute a query and return rows
  async query<T extends RowDataPacket[]>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await this.pool.execute<T>(sql, params);
    return rows;
  }

  // Execute an insert/update/delete and return result
  async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return result;
  }

  // Get a connection for transactions
  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  // Close the pool
  async close(): Promise<void> {
    await this.pool.end();
  }

  // Get the raw pool for direct access
  getPool(): Pool {
    return this.pool;
  }
}

// Singleton instance
export const db = new Database();
export const pool = db.getPool();
export default db;
