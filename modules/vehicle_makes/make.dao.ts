import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { VehicleMake } from './make.model';

const TABLE = 'vehicle_make';

export async function list(limit = 100, offset = 0): Promise<VehicleMake[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows as unknown as VehicleMake[];
}

export async function getById(id: number): Promise<VehicleMake | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
  return (rows[0] as unknown as VehicleMake) || null;
}

export async function create(data: VehicleMake): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}

export async function update(id: number, data: Partial<VehicleMake>): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`UPDATE ${TABLE} SET ? WHERE id = ?`, [data, id]);
  return res.affectedRows > 0;
}

export async function remove(id: number): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return res.affectedRows > 0;
}


