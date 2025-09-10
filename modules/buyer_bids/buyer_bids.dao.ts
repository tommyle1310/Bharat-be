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

export async function getBuyerBidHistory(buyerId: number): Promise<any[]> {
  const db: Pool = getDb();
  
  // Use static file serving for images
  const DEFAULT_IMG = "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800";
  const MANAGER_IMG = "https://images.unsplash.com/photo-1519211975560-4ca611f5a72a?w=800";

  const sql = `SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      v.regs_no AS regs_no,
      COALESCE(v.vehicle_image_id, 1) AS img_index,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      mk.make_name AS make,
      vmi.img_extension AS img_extension,
      md.model_name AS model,
      vv.variant_name AS variant,
      v.manufacturing_year AS manufacture_year,
      COALESCE(v.expected_price, v.base_price) AS bid_amount,
      st.staff AS manager_name,
      st.phone AS manager_phone,
      st.email AS manager_email,
      st.staff_id AS manager_id,
      ? AS manager_image,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END AS has_bidded,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN 'Winning' ELSE 'Losing' END AS bidding_status,
      MAX(bb.bid_amt) AS user_bid_amount,
      MAX(bb.created_dttm) AS bid_created_dttm
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    INNER JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert, bb1.bid_amt, bb1.created_dttm
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id
    GROUP BY v.vehicle_id
    ORDER BY MAX(bb.created_dttm) DESC`;

  console.log('=== getBuyerBidHistory DEBUG ===');
  console.log('SQL:', sql);
  console.log('Params:', [MANAGER_IMG, buyerId]);
  console.log('buyerId:', buyerId);

  const [rows] = await db.query<RowDataPacket[]>(sql, [MANAGER_IMG, buyerId]);
  
  console.log('Raw rows count:', rows.length);
  console.log('Raw rows vehicle_ids:', rows.map(r => r.vehicle_id));
  console.log('=== END getBuyerBidHistory DEBUG ===');
  
  return rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
    odometer: r.odometer != null ? String(r.odometer) : null,
    fuel: r.fuel ?? null,
    owner_serial: r.ownership_serial ?? null,
    state_code: typeof r.regs_no === 'string' && r.regs_no.length >= 2 ? r.regs_no.substring(0,2) : null,
    has_bidded: (r as any).has_bidded === 1,
    make: r.make ?? null,
    model: r.model ?? null,
    variant: r.variant ?? null,
    img_extension: r.img_extension ?? null,
    is_favorite: false,
    manufacture_year: r.manufacture_year ?? null,
    vehicleId: r.vehicle_id,
    imgIndex: (r as any).img_index ?? 1,
    bidding_status: r.bidding_status ?? null,
    bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
    manager_name: r.manager_name ?? null,
    manager_phone: r.manager_phone ?? null,
    manager_email: r.manager_email ?? null,
    manager_image: r.manager_image ?? MANAGER_IMG,
    manager_id: r.manager_id != null ? String(r.manager_id) : null,
    user_bid_amount: r.user_bid_amount != null ? String(r.user_bid_amount) : null,
    bid_created_dttm: r.bid_created_dttm ? new Date(r.bid_created_dttm).toISOString() : null,
  }));
}

export async function getBuyerBidHistoryByVehicle(buyerId: number, vehicleId: number): Promise<RowDataPacket[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT bid_id, vehicle_id, buyer_id, bid_amt, bid_mode, top_bid_at_insert, created_dttm
     FROM ${BUYER_BIDS_TABLE}
     WHERE buyer_id = ? AND vehicle_id = ?
     ORDER BY created_dttm DESC, bid_amt DESC`,
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


export async function updateOtherBuyerBidsTopBidStatus(vehicleId: number, excludeBuyerId: number): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `UPDATE ${BUYER_BIDS_TABLE} 
     SET top_bid_at_insert = 0 
     WHERE vehicle_id = ? AND buyer_id != ?`,
    [vehicleId, excludeBuyerId]
  );
}