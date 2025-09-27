import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { City } from './city.model';

const TABLE = 'cities';

export async function listByState(stateId: number): Promise<City[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} WHERE state_id = ? ORDER BY city ASC`, [stateId]);
  return rows as unknown as City[];
}

export async function list(): Promise<City[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY city ASC`);
  return rows as unknown as City[];
}

export async function create(data: City): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}


