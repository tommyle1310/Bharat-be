import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { State } from './state.model';

const TABLE = 'states';

export async function list(): Promise<State[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY id ASC`);
  return rows as unknown as State[];
}

export async function upsert(data: State): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} (id, state, region, rto) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE state=VALUES(state), region=VALUES(region), rto=VALUES(rto)`, [data.id, data.state, data.region ?? null, data.rto]);
}


