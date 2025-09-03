import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import { config } from './config';

let pool: Pool | null = null;

export function getDb(): Pool {
  if (pool) return pool;

  const options: PoolOptions = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    namedPlaceholders: true,
  };

  pool = mysql.createPool(options);
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}


