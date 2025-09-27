import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { CaseOption } from './case.model';

const TABLE = 'case_options';

export async function list({limit = 100, offset = 0}): Promise<CaseOption[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} ORDER BY id ASC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows as unknown as CaseOption[];
}

export async function upsert(data: CaseOption): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} (id, case_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE case_name=VALUES(case_name)`, [data.id, data.case_name]);
}


