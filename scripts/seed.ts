import mysql, { Connection, ResultSetHeader } from 'mysql2/promise';
import { config } from '../config/config';
import fs from 'fs';
import path from 'path';

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

function randomFutureDate(minHours = 2, maxDays = 10): string {
  const now = new Date();
  const minMs = minHours * 60 * 60 * 1000; // 2 giờ
  const maxMs = maxDays * 24 * 60 * 60 * 1000; // 10 ngày
  const delta = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  const future = new Date(now.getTime() + delta);
  
  // MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS'
  const yyyy = future.getFullYear();
  const mm = String(future.getMonth() + 1).padStart(2, "0");
  const dd = String(future.getDate()).padStart(2, "0");
  const hh = String(future.getHours()).padStart(2, "0");
  const min = String(future.getMinutes()).padStart(2, "0");
  const ss = String(future.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// Helpers to read data files if present
function tryReadJson<T>(fileName: string): T | null {
  const p = path.join(__dirname, '..', 'sql', 'data', fileName);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

// Hardcoded tables upsert from files if provided
async function ensureStates(conn: Connection) {
  type StateRow = { id: number; state: string; region: string | null; rto: string | null };
  const rows =
    tryReadJson<StateRow[]>('states.json') || [
      { id: 1, state: 'Andhra Pradesh', region: 'South', rto: 'AP' },
      { id: 2, state: 'Arunachal Pradesh', region: 'East', rto: 'AA' },
      { id: 3, state: 'Assam', region: 'East', rto: 'AS' },
      { id: 4, state: 'Bihar', region: 'East', rto: 'BR' },
      { id: 5, state: 'Chhattisgarh', region: 'East', rto: null },
      { id: 6, state: 'Goa', region: 'West', rto: null },
      { id: 7, state: 'Gujarat', region: 'West', rto: null },
      { id: 8, state: 'Haryana', region: 'North', rto: null },
      { id: 9, state: 'Himachal Pradesh', region: 'North', rto: null },
      { id: 10, state: 'Jharkhand', region: 'East', rto: null },
      { id: 11, state: 'Karnataka', region: 'South', rto: null },
      { id: 12, state: 'Kerala', region: 'South', rto: null },
      { id: 13, state: 'Madhya Pradesh', region: 'West', rto: null },
      { id: 14, state: 'Maharashtra', region: 'West', rto: null },
      { id: 15, state: 'Manipur', region: 'East', rto: null },
      { id: 16, state: 'Meghalaya', region: 'East', rto: null },
      { id: 17, state: 'Mizoram', region: 'East', rto: null },
      { id: 18, state: 'Nagaland', region: 'East', rto: null },
      { id: 19, state: 'Odisha', region: 'East', rto: null },
      { id: 20, state: 'Punjab', region: 'North', rto: null },
      { id: 21, state: 'Rajasthan', region: 'West', rto: null },
      { id: 22, state: 'Sikkim', region: 'East', rto: null },
      { id: 23, state: 'Tamil Nadu', region: 'South', rto: null },
      { id: 24, state: 'Telangana', region: 'South', rto: null },
      { id: 25, state: 'Tripura', region: 'East', rto: null },
      { id: 26, state: 'Uttar Pradesh', region: 'North', rto: null },
      { id: 27, state: 'Uttarakhand', region: 'North', rto: null },
      { id: 28, state: 'West Bengal', region: 'East', rto: null },
      { id: 29, state: 'Andaman and Nicobar Islands', region: 'South', rto: null },
      { id: 30, state: 'Chandigarh', region: 'North', rto: null },
      { id: 31, state: 'Dadra and Nagar Haveli and Daman and Diu', region: 'West', rto: null },
      { id: 32, state: 'Delhi', region: 'North', rto: null },
      { id: 33, state: 'Jammu and Kashmir', region: 'North', rto: null },
      { id: 34, state: 'Ladakh', region: 'North', rto: null },
      { id: 35, state: 'Lakshadweep', region: 'West', rto: null },
      { id: 36, state: 'Puducherry', region: 'South', rto: null },
    ];
  for (const s of rows) {
    const computed = (s.state
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0]?.toUpperCase() || '')
      .join('') || 'NA').slice(0, 2).padEnd(2, 'X');
    const rtoVal = (s.rto && s.rto.trim().length > 0) ? s.rto : computed;
    await conn.execute(
      'INSERT INTO `states` (id, state, region, rto) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE state=VALUES(state), region=VALUES(region), rto=VALUES(rto)',
      [s.id, s.state, s.region, rtoVal]
    );
  }
}

async function ensureCities(conn: Connection) {
  type CityRow = { state_id: number; city: string };
  const rows = tryReadJson<CityRow[]>('cities.json');
  if (!rows) return; // cities list is large; require file
  for (const c of rows) {
    await conn.execute('INSERT IGNORE INTO `cities` (state_id, city) VALUES (?, ?)', [c.state_id, c.city]);
  }
}

async function ensureCaseOptions(conn: Connection) {
  type CaseOptionRow = { id: number; case_name: string };
  const rows =
    tryReadJson<CaseOptionRow[]>('case_options.json') || [
      { id: 1, case_name: 'Luxury' },
      { id: 2, case_name: 'Theft' },
      { id: 3, case_name: 'Transit' },
      { id: 4, case_name: 'Flood' },
      { id: 5, case_name: 'Commercial' },
      { id: 6, case_name: 'Fire Loss' },
      { id: 7, case_name: 'Partial Salvage' },
      { id: 8, case_name: 'Ready to lift' },
    ];
  for (const co of rows) {
    await conn.execute(
      'INSERT INTO `case_options` (id, case_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE case_name=VALUES(case_name)',
      [co.id, co.case_name]
    );
  }
}

async function ensureFuelTypes(conn: Connection) {
  type FuelTypeRow = { id: number; fuel_type: string };
  const rows =
    tryReadJson<FuelTypeRow[]>('fuel_types.json') || [
      { id: 1, fuel_type: 'Petrol' },
      { id: 2, fuel_type: 'Diesel' },
      { id: 3, fuel_type: 'CNG only' },
      { id: 4, fuel_type: 'LNG' },
      { id: 5, fuel_type: 'LPG' },
      { id: 6, fuel_type: 'CNG-Petrol' },
      { id: 7, fuel_type: 'Hybrid' },
      { id: 8, fuel_type: 'Electric' },
      { id: 9, fuel_type: 'Ethanol' },
      { id: 10, fuel_type: 'Methanol' },
      { id: 11, fuel_type: 'Hydrogen' },
      { id: 12, fuel_type: 'Solar' },
    ];
  for (const f of rows) {
    await conn.execute(
      'INSERT INTO `fuel_types` (id, fuel_type) VALUES (?, ?) ON DUPLICATE KEY UPDATE fuel_type=VALUES(fuel_type)',
      [f.id, f.fuel_type]
    );
  }
}

async function ensureVehicleTypes(conn: Connection) {
  type VehicleTypeRow = { id: number; vehicle_type: string };
  const rows =
    tryReadJson<VehicleTypeRow[]>('vehicle_types.json') || [
      { id: 10, vehicle_type: '2W' },
      { id: 20, vehicle_type: '3W' },
      { id: 30, vehicle_type: '4W' },
      { id: 40, vehicle_type: 'Bus' },
      { id: 50, vehicle_type: 'Truck' },
      { id: 60, vehicle_type: 'Commercial' },
      { id: 70, vehicle_type: 'Form Equipment' },
      { id: 80, vehicle_type: 'Construction Equipment' },
    ];
  for (const vt of rows) {
    await conn.execute(
      'INSERT INTO `vehicle_types` (id, vehicle_type) VALUES (?, ?) ON DUPLICATE KEY UPDATE vehicle_type=VALUES(vehicle_type)',
      [vt.id, vt.vehicle_type]
    );
  }
}

async function ensureOwnershipSerial(conn: Connection) {
  type OwnershipSerialRow = { id: number; ownership_serial: string };
  const rows =
    tryReadJson<OwnershipSerialRow[]>('ownership_serial.json') || [
      { id: 1, ownership_serial: '0' },
      { id: 2, ownership_serial: '1' },
      { id: 3, ownership_serial: '2' },
      { id: 4, ownership_serial: '3' },
      { id: 5, ownership_serial: '4' },
      { id: 6, ownership_serial: '5+' },
    ];
  for (const os of rows) {
    await conn.execute(
      'INSERT INTO `ownership_serial` (id, ownership_serial) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownership_serial=VALUES(ownership_serial)',
      [os.id, os.ownership_serial]
    );
  }
}

async function seedVehicleMakes(conn: Connection): Promise<number[]> {
  const ids: number[] = [];
  const makes = ['Honda', 'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra'];
  for (let i = 0; i < makes.length; i++) {
    const [res] = await conn.execute<ResultSetHeader>('INSERT INTO `vehicle_make` (make_name) VALUES (?)', [makes[i]]);
    ids.push((res as ResultSetHeader).insertId);
  }
  return ids;
}

async function seedVehicleModels(conn: Connection, makeIds: number[]): Promise<number[]> {
  const ids: number[] = [];
  const models = ['BRIO', 'Swift', 'i20', 'Nexon', 'XUV300'];
  for (let i = 0; i < models.length; i++) {
    const makeId = makeIds[i % makeIds.length];
    const [res] = await conn.execute<ResultSetHeader>('INSERT INTO `vehicle_model` (vehicle_make_id, model_name) VALUES (?, ?)', [makeId, models[i]]);
    ids.push((res as ResultSetHeader).insertId);
  }
  return ids;
}

async function seedVehicleVariants(conn: Connection, modelIds: number[]): Promise<number[]> {
  const ids: number[] = [];
  const variants = ['1.2 VX AT', '1.2 V MT', '1.0 Turbo GDI', 'EV Prime', 'Petrol MT'];
  for (let i = 0; i < variants.length; i++) {
    const modelId = modelIds[i % modelIds.length];
    const [res] = await conn.execute<ResultSetHeader>('INSERT INTO `vehicle_variant` (vehicle_model_id, variant_name) VALUES (?, ?)', [modelId, variants[i]]);
    ids.push((res as ResultSetHeader).insertId);
  }
  return ids;
}

async function getFuelTypeIds(conn: Connection): Promise<number[]> {
  const [rows] = await conn.query<any[]>('SELECT id FROM `fuel_types` ORDER BY id');
  return rows.map(row => row.id);
}

// Vehicle images first (placeholder vehicle_id=0), then vehicles, then update images to link
async function seedVehicleImages(conn: Connection): Promise<number[]> {
  const imageIds: number[] = [];
  for (let i = 0; i < 5; i++) {
    const [res] = await conn.execute<ResultSetHeader>('INSERT INTO `vehicle_images` (vehicle_id, img_extension) VALUES (?, ?)', [0, 'jpg']);
    imageIds.push((res as ResultSetHeader).insertId);
  }
  return imageIds;
}

async function seedVehicles( 
  conn: Connection,
  makeIds: number[],
  modelIds: number[],
  variantIds: number[],
  imageIds: number[],
  fuelTypeIds: number[],
) {
  const [staffRows] = await conn.query<any[]>('SELECT staff_id FROM `staff` ORDER BY staff_id');
  const staffIds = staffRows.map(row => row.staff_id);
  
  for (let i = 0; i < 5; i++) {
    const full = i < 2;
    const makeId = makeIds[i % makeIds.length];
    const modelId = modelIds[i % modelIds.length];
    const variantId = variantIds[i % variantIds.length];
    const imageId = imageIds[i % imageIds.length];
    const fuelTypeId = fuelTypeIds[i % fuelTypeIds.length];
    const vehicleManagerId = staffIds[i % staffIds.length];

    const auctionEnd = randomFutureDate(2, 10); // random 2 giờ -> 10 ngày

    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO vehicles
        (
          vehicle_make_id,
          vehicle_model_id,
          vehicle_variant_id,
          vehicle_image_id,
          fuel_type_id,
          vehicle_manager_id,
          seller_id,
          regs_no,
          manufacturing_year,
          vehicle_state_id,
          auction_status_id,
          base_price,
          expected_price,
          odometer_reading,
          color,
          chasis_no,
          added_on,
          updated_on,
          auction_end_dttm,
          seller_mgr_name,
          contact_person_name,
          vehicle_mgr_name,
          vehicle_mgr_contact_no,
          vehicle_mgr_email
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
      [
        makeId,
        modelId,
        variantId,
        imageId,
        fuelTypeId,
        vehicleManagerId,
        100 + i,
        `REG-${1000 + i}`,
        full ? '2015' : (2000 + Math.floor(Math.random() * 20)).toString(),
        Math.floor(Math.random() * 36),
        Math.floor(Math.random() * 9),
        full ? 100000 + i * 1000 : null,
        full ? 120000 + i * 1000 : null,
        full ? 50000 + (i * 10000) : null,
        full ? ['White', 'Black', 'Silver', 'Red', 'Blue'][i % 5] : null,
        full ? `CH${100000 + i}` : null,
        auctionEnd,
        `SellerMgr${i}`,       // seller_mgr_name
        `ContactPerson${i}`,   // contact_person_name
        `VehicleMgr${i}`,      // vehicle_mgr_name
        `123456789${i}`,       // vehicle_mgr_contact_no
        `veh${i}@example.com`  // vehicle_mgr_email
      ]
    );
    
    

    const vehicleId = (res as ResultSetHeader).insertId;
    await conn.execute(
      'UPDATE vehicle_images SET vehicle_id = ? WHERE vehicle_image_id = ?',
      [vehicleId, imageId]
    );
  }
}


// Staff and Buyers at end

async function seedStaff(conn: Connection) {
  for (let i = 1; i <= 5; i++) {
    const full = i <= 2;
    const name = `Staff ${i}`;
    const phone =  `+10000000${1000 + i}` ;
    const email = `staff${i}@example.com` ;
    await conn.execute('INSERT INTO `staff` (staff, phone, email, added_on, updated_on) VALUES (?, ?, ?, NOW(), NOW())', [name, phone, email]);
  }
}

async function seedBuyers(conn: Connection) {
  for (let i = 1; i <= 5; i++) {
    const full = i <= 2;
    const name = `Buyer ${i}`;
    const mobile = full ? `+1999000${1000 + i}` : `+1999000${2000 + i}`;
    const category_id = i % 2 === 0 ? 10 : 20;
    const company_name = full ? `Company ${i}` : null;
    const email = full ? `buyer${i}@example.com` : null;
    const address = full ? `Street ${i}` : null;
    const buyer_status = 1;
    await conn.execute(
      `INSERT INTO \`buyer\` (name, mobile, category_id, company_name, email, address, city_id, state_id, pincode, information_for_buyer, team_remarks, pan_number, aadhaar_number, security_deposit, bid_limit, expiry_date, renew_date, buyer_status, is_dummy, verify_status, police_verification_status, pan_verification_status, aadhaar_verification_status, is_logged_in, gst_no, aadhar_doc_id, pan_doc_id, pcc_doc_id, gst_certificate_doc_id, other_doc_id, img_extn_aadhaar_front, img_extn_aadhaar_back, img_extn_pan, img_extn_cancelled_cheque, img_extn_pcc, img_extn_gst, img_extn_other, added_on, added_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, DATE_ADD(CURDATE(), INTERVAL 1 YEAR), NULL, ?, 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), 1)`,
      [name, mobile, category_id, company_name, email, address, buyer_status]
    );
  }
}

// Main

async function main() {
  await withConnection(async (conn) => {
    // Hardcoded reference tables first (if data files exist)
    await ensureStates(conn);
    await ensureCities(conn);
    await ensureFuelTypes(conn);
    await ensureCaseOptions(conn);
    await ensureVehicleTypes(conn);
    await ensureOwnershipSerial(conn);

    // Ordered seeding with FK pools
    const makeIds = await seedVehicleMakes(conn);
    const modelIds = await seedVehicleModels(conn, makeIds);
    const variantIds = await seedVehicleVariants(conn, modelIds);
    const imageIds = await seedVehicleImages(conn);
    const fuelTypeIds = await getFuelTypeIds(conn);
    await seedStaff(conn); // Seed staff first to get staff IDs
    await seedVehicles(conn, makeIds, modelIds, variantIds, imageIds, fuelTypeIds);
    await seedBuyers(conn);
  });
  console.log('Seeding completed');
}

main().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});


