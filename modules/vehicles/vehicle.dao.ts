import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { Vehicle } from './vehicle.model';

const TABLE = 'vehicle';

export async function listVehicles(limit = 50, offset = 0): Promise<Vehicle[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} ORDER BY vehicle_id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows as unknown as Vehicle[];
}

export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} WHERE vehicle_id = ? LIMIT 1`,
    [id]
  );
  const row = rows[0] as unknown as Vehicle | undefined;
  return row || null;
}

export async function createVehicle(data: Vehicle): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `INSERT INTO ${TABLE} SET ?`,
    [data]
  );
  return res.insertId;
}

export async function updateVehicle(id: number, data: Partial<Vehicle>): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `UPDATE ${TABLE} SET ? WHERE vehicle_id = ?`,
    [data, id]
  );
  return res.affectedRows > 0;
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `DELETE FROM ${TABLE} WHERE vehicle_id = ?`,
    [id]
  );
  return res.affectedRows > 0;
}


