import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";

export interface AutoBidRecord {
  vehicle_id: number;
  buyer_id: number;
  bid_start_amt: number;
  step_amt: number;
  max_bid_amt: number;
  max_steps: number;
  pending_steps: number;
  last_bid_amt: number;
}

const AUTO_BID_TABLE = "auto_bid";

export async function upsertAutoBid(rec: AutoBidRecord): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `INSERT INTO ${AUTO_BID_TABLE}
      (vehicle_id, buyer_id, bid_start_amt, step_amt, max_bid_amt, max_steps, pending_steps, last_bid_amt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      bid_start_amt = VALUES(bid_start_amt),
      step_amt = VALUES(step_amt),
      max_bid_amt = VALUES(max_bid_amt),
      max_steps = VALUES(max_steps),
      pending_steps = VALUES(pending_steps),
      last_bid_amt = VALUES(last_bid_amt)`,
    [rec.vehicle_id, rec.buyer_id, rec.bid_start_amt, rec.step_amt, rec.max_bid_amt, rec.max_steps, rec.pending_steps, rec.last_bid_amt]
  );
}

export async function listActiveAutoBids(): Promise<RowDataPacket[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT vehicle_id, buyer_id, bid_start_amt, step_amt, max_bid_amt, max_steps, pending_steps, last_bid_amt
     FROM ${AUTO_BID_TABLE}`
  );
  return rows;
}

export async function getAutoBidsByBuyer(buyerId: number): Promise<RowDataPacket[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ab.vehicle_id, ab.buyer_id, ab.bid_start_amt, ab.step_amt, ab.max_bid_amt, ab.max_steps, ab.pending_steps, ab.last_bid_amt,
            v.base_price, v.max_price, v.auction_end_dttm AS end_time,
            vm.make_name AS make, vmo.model_name AS model, vv.variant_name AS variant
     FROM ${AUTO_BID_TABLE} ab
     LEFT JOIN vehicles v ON v.vehicle_id = ab.vehicle_id
     LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id
     LEFT JOIN vehicle_model vmo ON v.vehicle_model_id = vmo.vehicle_model_id
     LEFT JOIN vehicle_variant vv ON v.vehicle_variant_id = vv.vehicle_variant_id
     WHERE ab.buyer_id = ?
     ORDER BY ab.vehicle_id`,
    [buyerId]
  );
  return rows;
}

export async function getAutoBidByVehicleAndBuyer(vehicleId: number, buyerId: number): Promise<RowDataPacket | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ab.vehicle_id, ab.buyer_id, ab.bid_start_amt, ab.step_amt, ab.max_bid_amt, ab.max_steps, ab.pending_steps, ab.last_bid_amt,
            v.base_price, v.max_price, v.auction_end_dttm AS end_time,
            vm.make_name AS make, vmo.model_name AS model, vv.variant_name AS variant
     FROM ${AUTO_BID_TABLE} ab
     LEFT JOIN vehicles v ON v.vehicle_id = ab.vehicle_id
     LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id
     LEFT JOIN vehicle_model vmo ON v.vehicle_model_id = vmo.vehicle_model_id
     LEFT JOIN vehicle_variant vv ON v.vehicle_variant_id = vv.vehicle_variant_id
     WHERE ab.vehicle_id = ? AND ab.buyer_id = ?
     LIMIT 1`,
    [vehicleId, buyerId]
  );
  return rows.length > 0 ? rows[0]! : null;
}

export async function updateAutoBid(vehicleId: number, buyerId: number, rec: Partial<AutoBidRecord>): Promise<boolean> {
  const db: Pool = getDb();
  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (rec.bid_start_amt !== undefined) {
    updateFields.push('bid_start_amt = ?');
    updateValues.push(rec.bid_start_amt);
  }
  if (rec.step_amt !== undefined) {
    updateFields.push('step_amt = ?');
    updateValues.push(rec.step_amt);
  }
  if (rec.max_bid_amt !== undefined) {
    updateFields.push('max_bid_amt = ?');
    updateValues.push(rec.max_bid_amt);
  }
  if (rec.max_steps !== undefined) {
    updateFields.push('max_steps = ?');
    updateValues.push(rec.max_steps);
  }
  if (rec.pending_steps !== undefined) {
    updateFields.push('pending_steps = ?');
    updateValues.push(rec.pending_steps);
  }
  if (rec.last_bid_amt !== undefined) {
    updateFields.push('last_bid_amt = ?');
    updateValues.push(rec.last_bid_amt);
  }

  if (updateFields.length === 0) {
    return false; // No fields to update
  }

  updateValues.push(vehicleId, buyerId);

  const [res] = await db.query<ResultSetHeader>(
    `UPDATE ${AUTO_BID_TABLE} SET ${updateFields.join(', ')} WHERE vehicle_id = ? AND buyer_id = ?`,
    updateValues
  );

  return res.affectedRows > 0;
}

export async function removeAutoBid(vehicleId: number, buyerId: number): Promise<boolean> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `DELETE FROM ${AUTO_BID_TABLE} WHERE vehicle_id = ? AND buyer_id = ?`,
    [vehicleId, buyerId]
  );
  return res.affectedRows > 0;
}


