import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";

export interface BuyerBidRecord {
  bid_id?: number;
  vehicle_id: number;
  buyer_id: number;
  bid_amt: number;
  is_surrogate: 0 | 1;
  bid_mode: 'M' | 'A';
  top_bid_at_insert: number;
  created_dttm?: Date;
  user_id: number;
}

const BUYER_BIDS_TABLE = "buyer_bids";

export async function getBuyerBidHistory(buyerId: number): Promise<RowDataPacket[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT bid_id, vehicle_id, buyer_id, bid_amt, bid_mode, top_bid_at_insert, created_dttm
     FROM ${BUYER_BIDS_TABLE}
     WHERE buyer_id = ?
     ORDER BY created_dttm DESC`,
    [buyerId]
  );
  return rows;
}

export async function getBuyerBidHistoryByVehicle(buyerId: number, vehicleId: number): Promise<RowDataPacket[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT bid_id, vehicle_id, buyer_id, bid_amt, bid_mode, top_bid_at_insert, created_dttm
     FROM ${BUYER_BIDS_TABLE}
     WHERE buyer_id = ? AND vehicle_id = ?
     ORDER BY created_dttm DESC`,
    [buyerId, vehicleId]
  );
  return rows;
}

export async function getLatestBuyerBidForVehicle(buyerId: number, vehicleId: number): Promise<number | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT bid_amt FROM ${BUYER_BIDS_TABLE}
     WHERE buyer_id = ? AND vehicle_id = ?
     ORDER BY created_dttm DESC, bid_id DESC LIMIT 1`,
    [buyerId, vehicleId]
  );
  if (rows.length === 0) return null;
  return Number(rows[0]!.bid_amt);
}

export async function insertBuyerBid(bid: BuyerBidRecord): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `INSERT INTO ${BUYER_BIDS_TABLE}
     (vehicle_id, buyer_id, bid_amt, is_surrogate, bid_mode, top_bid_at_insert, created_dttm, user_id)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
    [bid.vehicle_id, bid.buyer_id, bid.bid_amt, bid.is_surrogate, bid.bid_mode, bid.top_bid_at_insert]
  );
  return res.insertId;
}

export async function getTopBidForVehicle(vehicleId: number): Promise<{ amount: number, buyer_id: number } | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT buyer_id, bid_amt FROM ${BUYER_BIDS_TABLE}
     WHERE vehicle_id = ?
     ORDER BY bid_amt DESC, created_dttm DESC LIMIT 1`,
    [vehicleId]
  );
  if (rows.length === 0) return null;
  return { amount: Number(rows[0]!.bid_amt), buyer_id: Number(rows[0]!.buyer_id) };
}


