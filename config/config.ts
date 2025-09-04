import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
console.log('check env config', process.env.REDIS_HOST, process.env.REDIS_PORT, process.env.DB_USER, process.env.DB_PASSWORD, process.env.DB_NAME, process.env.DB_CONN_LIMIT);
export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),

  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'kmsguser',
    password: process.env.DB_PASSWORD || 'kmsgpass',
    database: process.env.DB_NAME || 'kmsgdb',
    connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
    tls: process.env.REDIS_TLS === 'true' && process.env.REDIS_HOST !== '127.0.0.1'
    ? {}
    : undefined
  
  },
} as const;

export type AppConfig = typeof config;
