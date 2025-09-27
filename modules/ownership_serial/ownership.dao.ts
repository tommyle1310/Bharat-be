import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { OwnershipSerial } from './ownership.model';

const TABLE = 'ownership_serial';

export async function list(limit = 100, offset = 0): Promise<OwnershipSerial[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as OwnershipSerial[];
}

export async function create(data: OwnershipSerial): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}


