import mysql from 'mysql2/promise';
import { config } from '../config/config';

async function main() {
  console.log('cehck config', config.db)
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
  await conn.query(`USE \`${config.db.database}\``);

  const tables = [
    'vehicle_images',
    'vehicles',
    'vehicle_variant',
    'vehicle_model',
    'vehicle_make',
    'buyer',
    'staff',
    'cities',
    'states',
    'case_options',
    'fuel_types'
  ];

  for (const t of tables) {
    await conn.query(`SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE \`${t}\`; SET FOREIGN_KEY_CHECKS=1;`);
  }

  await conn.end();
  console.log('Database reset (tables truncated).');
}

main().catch((err) => {
  console.error('Reset failed', err);
  process.exit(1);
});


