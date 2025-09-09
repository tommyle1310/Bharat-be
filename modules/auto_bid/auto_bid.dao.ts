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


