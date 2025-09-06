import dotenv from 'dotenv';
import path from 'path';

// Lấy NODE_ENV, mặc định là 'development'
const env = process.env.NODE_ENV || 'development';

// Try to load specific env file, fallback to .env if not found
const envFile = path.resolve(__dirname, `../.env.${env}`);
const fallbackEnvFile = path.resolve(__dirname, '../.env');

// Load environment variables
try {
  dotenv.config({ path: envFile });
  console.log(`Loaded environment from .env.${env}`);
} catch (error) {
  console.log(`No .env.${env} found, trying .env...`);
  try {
    dotenv.config({ path: fallbackEnvFile });
    console.log('Loaded environment from .env');
  } catch (fallbackError) {
    console.log('No .env file found, using system environment variables');
  }
}

console.log('check env config', process.env.REDIS_HOST, process.env.REDIS_PORT, process.env.DB_USER, process.env.DB_PASSWORD, process.env.DB_NAME, process.env.DB_CONN_LIMIT);

// Log static file paths
const staticConfig = {
  publicPath: path.join(__dirname, '../public'),
  dataFilesPath: process.env.DATA_FILES_PATH 
    || process.env.DIR_BASE 
    || path.join(__dirname, '../../data-files'),
  publicUrl: process.env.PUBLIC_URL || '/public',
  dataFilesUrl: process.env.DATA_FILES_URL || '/data-files',
};

console.log('Static files config:', staticConfig);
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

  // Static files configuration
  static: {
    // Local public directory (for backend-specific static files)
    publicPath: path.join(__dirname, '../public'),
    // External data-files directory (sibling to backend)
    dataFilesPath: process.env.DATA_FILES_PATH || path.join(__dirname, '../../data-files'),
    // Public URL paths
    publicUrl: process.env.PUBLIC_URL || '/public',
    dataFilesUrl: process.env.DATA_FILES_URL || '/data-files',
  },
} as const;

export type AppConfig = typeof config;
