import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config/config';

async function main() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  // Ensure database exists
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
  await connection.query(`USE \`${config.db.database}\``);

  // Split on semicolons that end statements; tolerate extra whitespace
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await connection.query(stmt);
  }

  await connection.end();
  console.log('Migration completed');
}

main().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});


