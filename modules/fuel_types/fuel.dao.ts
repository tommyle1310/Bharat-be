import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { FuelType } from './fuel.model';

const TABLE = 'fuel_types';

export async function list(): Promise<FuelType[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY id ASC`);
  return rows as unknown as FuelType[];
}

export async function upsert(data: FuelType): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} (id, fuel_type) VALUES (?, ?) ON DUPLICATE KEY UPDATE fuel_type=VALUES(fuel_type)`, [data.id, data.fuel_type]);
}


