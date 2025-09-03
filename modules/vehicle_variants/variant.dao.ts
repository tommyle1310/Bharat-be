import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { VehicleVariant } from './variant.model';

const TABLE = 'vehicle_variant';

export async function list(limit = 100, offset = 0): Promise<VehicleVariant[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY vehicle_variant_id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as VehicleVariant[];
}

export async function getById(id: number): Promise<VehicleVariant | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} WHERE vehicle_variant_id = ? LIMIT 1`, [id]);
  return (rows[0] as unknown as VehicleVariant) || null;
}

export async function create(data: VehicleVariant): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}

export async function update(id: number, data: Partial<VehicleVariant>): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`UPDATE ${TABLE} SET ? WHERE vehicle_variant_id = ?`, [data, id]);
  return res.affectedRows > 0;
}

export async function remove(id: number): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`DELETE FROM ${TABLE} WHERE vehicle_variant_id = ?`, [id]);
  return res.affectedRows > 0;
}


