import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDb } from '../../config/database';
import { VehicleImage } from './image.model';

const TABLE = 'vehicle_images';

export async function listByVehicle(vehicleId: number): Promise<VehicleImage[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${TABLE} WHERE vehicle_id = ? ORDER BY vehicle_image_id ASC`, [vehicleId]);
  return rows as unknown as VehicleImage[];
}

export async function create(data: VehicleImage): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [data]);
  return res.insertId;
}

export async function remove(id: number): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(`DELETE FROM ${TABLE} WHERE vehicle_image_id = ?`, [id]);
  return res.affectedRows > 0;
}


