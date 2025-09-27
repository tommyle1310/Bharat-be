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

export async function searchStates(query: string, limit = 50, offset = 0): Promise<State[]> {
  const db: Pool = getDb();
  const searchTerm = `%${query.trim()}%`;
  
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} 
     WHERE state LIKE ? OR region LIKE ?
     ORDER BY state ASC
     LIMIT ? OFFSET ?`,
    [searchTerm, searchTerm, limit, offset]
  );
  
  return rows as unknown as State[];
}

export async function getStatesCount(): Promise<number> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM ${TABLE}`
  );
  
  return rows[0]?.count || 0;
}

export async function getStatesSearchCount(query: string): Promise<number> {
  const db: Pool = getDb();
  const searchTerm = `%${query.trim()}%`;
  
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM ${TABLE} 
     WHERE state LIKE ? OR region LIKE ?`,
    [searchTerm, searchTerm]
  );
  
  return rows[0]?.count || 0;
}


