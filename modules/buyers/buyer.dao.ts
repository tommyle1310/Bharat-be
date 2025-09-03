import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { Buyer } from './buyer.model';

const TABLE = 'buyer';

export async function list(limit = 100, offset = 0): Promise<Buyer[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY buyer_id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as Buyer[];
}

export async function getById(id: number): Promise<Buyer | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} WHERE buyer_id = ? LIMIT 1`, [id]);
  return (rows[0] as unknown as Buyer) || null;
}

export async function create(data: Buyer): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}

export async function update(id: number, data: Partial<Buyer>): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`UPDATE ${TABLE} SET ? WHERE buyer_id = ?`, [data, id]);
  return res.affectedRows > 0;
}


