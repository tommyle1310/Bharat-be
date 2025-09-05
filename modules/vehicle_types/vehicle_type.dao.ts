import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { VehicleType } from './vehicle_type';

const TABLE = 'vehicle_types';

export async function list(limit = 100, offset = 0): Promise<VehicleType[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as VehicleType[];
}

export async function create(data: VehicleType): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}


