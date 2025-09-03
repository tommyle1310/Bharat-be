import mysql, { Connection } from 'mysql2/promise';
import { config } from '../config/config';

async function withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
    await conn.query(`USE \`${config.db.database}\``);
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

async function getMax(conn: Connection, table: string, idCol: string): Promise<number> {
  const [rows] = await conn.query<any[]>(`SELECT MAX(${idCol}) AS maxId FROM \`${table}\``);
  const maxId = rows[0]?.maxId as number | null | undefined;
  return maxId ? Number(maxId) : 0;
}

async function seedVehicleMakes(conn: Connection) {
  const start = await getMax(conn, 'vehicle_make', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    await conn.execute('INSERT INTO `vehicle_make` (id, make_name) VALUES (?, ?)', [id, `Make ${id}`]);
  }
}

async function seedVehicleModels(conn: Connection) {
  const start = await getMax(conn, 'vehicle_model', 'vehicle_model_id');
  const maxMake = await getMax(conn, 'vehicle_make', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    const makeId = Math.max(1, maxMake - 5 + i);
    await conn.execute('INSERT INTO `vehicle_model` (vehicle_model_id, vehicle_make_id, model_name) VALUES (?, ?, ?)', [id, makeId, `Model ${id}`]);
  }
}

async function seedVehicleVariants(conn: Connection) {
  const start = await getMax(conn, 'vehicle_variant', 'vehicle_variant_id');
  const maxModel = await getMax(conn, 'vehicle_model', 'vehicle_model_id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    const modelId = Math.max(1, maxModel - 5 + i);
    await conn.execute('INSERT INTO `vehicle_variant` (vehicle_variant_id, vehicle_model_id, variant_name) VALUES (?, ?, ?)', [id, modelId, `Variant ${id}`]);
  }
}

async function seedFuelTypes(conn: Connection) {
  const start = await getMax(conn, 'fuel_types', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    await conn.execute('INSERT INTO `fuel_types` (id, fuel_type) VALUES (?, ?)', [id, `Fuel ${id}`]);
  }
}

async function seedCaseOptions(conn: Connection) {
  const start = await getMax(conn, 'case_options', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    await conn.execute('INSERT INTO `case_options` (id, case_name) VALUES (?, ?)', [id, `Case ${id}`]);
  }
}

async function seedStates(conn: Connection) {
  const start = await getMax(conn, 'states', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i;
    const rto = `R${(id % 26).toString(36).toUpperCase()}`.padEnd(2, 'X').slice(0, 2);
    await conn.execute('INSERT INTO `states` (id, state, region, rto) VALUES (?, ?, ?, ?)', [id, `State ${id}`, null, rto]);
  }
}

async function seedCities(conn: Connection) {
  const start = await getMax(conn, 'cities', 'city_id');
  const maxState = await getMax(conn, 'states', 'id');
  for (let i = 1; i <= 5; i++) {
    const id = start + i; // not used, AI
    const stateId = Math.max(1, maxState - 5 + i);
    await conn.execute('INSERT INTO `cities` (state_id, city) VALUES (?, ?)', [stateId, `City ${stateId}-${Date.now()}-${i}`]);
  }
}

async function seedStaff(conn: Connection) {
  for (let i = 1; i <= 5; i++) {
    await conn.execute('INSERT INTO `staff` (staff, phone, email, added_on, updated_on) VALUES (?, ?, ?, NOW(), NOW())', [
      `Staff ${Date.now()}-${i}`,
      `+10000000${Math.floor(Math.random() * 9000 + 1000)}`,
      `staff${Date.now()}${i}@example.com`,
    ]);
  }
}

async function seedBuyers(conn: Connection) {
  for (let i = 1; i <= 5; i++) {
    await conn.execute(
      'INSERT INTO `buyer` (name, mobile, business_vertical, expiry_date, buyer_status, added_on, added_by) VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 1 YEAR), ?, NOW(), ?)',
      [
        `Buyer ${Date.now()}-${i}`,
        `+1999000${Math.floor(Math.random() * 9000 + 1000)}`,
        i % 2 === 0 ? 'A' : 'B',
        1,
        1,
      ]
    );
  }
}

async function seedVehicles(conn: Connection) {
  const maxMake = await getMax(conn, 'vehicle_make', 'id');
  const maxModel = await getMax(conn, 'vehicle_model', 'vehicle_model_id');
  const maxVariant = await getMax(conn, 'vehicle_variant', 'vehicle_variant_id');
  for (let i = 1; i <= 5; i++) {
    const makeId = Math.max(1, maxMake - 5 + i);
    const modelId = Math.max(1, maxModel - 5 + i);
    const variantId = Math.max(1, maxVariant - 5 + i);
    await conn.execute(
      'INSERT INTO `vehicle` (vehicle_make_id, vehicle_model_id, vehicle_variant_id, seller_id, business_vertical, regs_no, added_on, updated_on) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [makeId, modelId, variantId, i, i % 2 === 0 ? 'A' : 'B', `REG-${Date.now()}-${i}`]
    );
  }
}

async function seedVehicleImages(conn: Connection) {
  const [rows] = await conn.query<any[]>(`SELECT vehicle_id FROM vehicle ORDER BY vehicle_id DESC LIMIT 5`);
  const vehicles: number[] = rows.map(r => Number(r.vehicle_id));
  for (const vid of vehicles) {
    await conn.execute('INSERT INTO `vehicle_images` (vehicle_id, img_extension) VALUES (?, ?)', [vid, 'jpg']);
  }
}

async function main() {
  await withConnection(async (conn) => {
    // Order matters for FK-like relationships
    await seedVehicleMakes(conn);
    await seedVehicleModels(conn);
    await seedVehicleVariants(conn);
    await seedFuelTypes(conn);
    await seedCaseOptions(conn);
    await seedStates(conn);
    await seedCities(conn);
    await seedStaff(conn);
    await seedBuyers(conn);
    await seedVehicles(conn);
    await seedVehicleImages(conn);
  });
  console.log('Seeding completed');
}

main().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});


