import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { Staff } from './staff.model';

const TABLE = 'staff';

export async function list(limit = 100, offset = 0): Promise<Staff[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY staff_id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as Staff[];
}

export async function create(data: Staff): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}


