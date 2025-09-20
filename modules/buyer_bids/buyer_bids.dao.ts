import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { getRedis } from "../../config/redis";
import { getIO } from "../../config/socket";
import { checkBuyerAccess } from "../buyer_access/buyer_access.dao";

// Pagination constants
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

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

export async function getBuyerBidHistory(buyerId: number, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<{ data: any[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;
  
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
    ORDER BY MAX(bb.created_dttm) DESC
    LIMIT ? OFFSET ?`;

  // Get total count first
  const countSql = `
    SELECT COUNT(*) as total
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
  `;

  const [countRows] = await db.query<RowDataPacket[]>(countSql, [buyerId]);
  const total = countRows[0]?.total || 0;

  console.log('=== getBuyerBidHistory DEBUG ===');
  console.log('SQL:', sql);
  console.log('Params:', [MANAGER_IMG, buyerId, safePageSize, offset]);
  console.log('buyerId:', buyerId);

  const [rows] = await db.query<RowDataPacket[]>(sql, [MANAGER_IMG, buyerId, safePageSize, offset]);
  
  console.log('Raw rows count:', rows.length);
  console.log('Raw rows vehicle_ids:', rows.map(r => r.vehicle_id));
  console.log('=== END getBuyerBidHistory DEBUG ===');
  
  const data = rows.map((r) => ({
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

  return {
    data,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}

export async function getBuyerBidHistoryByVehicle(buyerId: number, vehicleId: number, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<{ data: RowDataPacket[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  // Get total count first
  const [countRows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM ${BUYER_BIDS_TABLE} WHERE buyer_id = ? AND vehicle_id = ?`,
    [buyerId, vehicleId]
  );
  const total = countRows[0]?.total || 0;

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT bid_id, vehicle_id, buyer_id, bid_amt, bid_mode, top_bid_at_insert, created_dttm
     FROM ${BUYER_BIDS_TABLE}
     WHERE buyer_id = ? AND vehicle_id = ?
     ORDER BY created_dttm DESC, bid_amt DESC
     LIMIT ? OFFSET ?`,
    [buyerId, vehicleId, safePageSize, offset]
  );

  return {
    data: rows,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
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

export async function insertBuyerBid(bid: BuyerBidRecord, auctionEndDttmForPayload?: string | null): Promise<number> {
  // Check buyer access before allowing bid
  const accessCheck = await checkBuyerAccess(bid.buyer_id, bid.vehicle_id);
  if (!accessCheck.hasAccess) {
    const firstReason = accessCheck.missingAccess[0] || "You don't have access to place bid on this vehicle";
    throw new Error(firstReason);
  }

  // Check max price limit
  const db: Pool = getDb();
  const [vehicleRows] = await db.query<RowDataPacket[]>(`
    SELECT max_price, auction_end_dttm, final_expiry_dttm FROM vehicles WHERE vehicle_id = ?
  `, [bid.vehicle_id]);
  
  if (vehicleRows.length > 0 && vehicleRows[0]?.max_price != null) {
    const maxPrice = Number(vehicleRows[0].max_price);
    if (bid.bid_amt > maxPrice) {
      throw new Error(`You bid too high!`);
    }
  }
  // Determine payload auctionEndDttm
  let auctionEndDttm: string | null;
  if (typeof auctionEndDttmForPayload !== 'undefined') {
    auctionEndDttm = auctionEndDttmForPayload;
    console.log('[insertBuyerBid][PAYLOAD] Using caller-provided auctionEndDttmForPayload =', auctionEndDttmForPayload);
  } else {
    const rawAuctionEnd = (vehicleRows[0] as any)?.auction_end_dttm as any;
    auctionEndDttm = rawAuctionEnd ?? null;
    try {
      const [endCheck] = await db.query<RowDataPacket[]>(
        `SELECT (auction_end_dttm <= NOW()) AS ended FROM vehicles WHERE vehicle_id = ?`,
        [bid.vehicle_id]
      );
      const ended = Boolean(endCheck?.[0]?.ended);
      console.log('[insertBuyerBid][TIME][DB] vehicle_id=', bid.vehicle_id, 'auction_end_dttm=', rawAuctionEnd, 'ended=', ended);
      if (ended) auctionEndDttm = null;
    } catch (e) {
      console.error('[insertBuyerBid][TIME][DB] Failed to check end state', e);
    }
  }
  const [res] = await db.query<ResultSetHeader>(
    `INSERT INTO ${BUYER_BIDS_TABLE}
     (vehicle_id, buyer_id, bid_amt, is_surrogate, bid_mode, top_bid_at_insert, created_dttm, user_id)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
    [bid.vehicle_id, bid.buyer_id, bid.bid_amt, bid.is_surrogate, bid.bid_mode, bid.top_bid_at_insert]
  );
  // Ensure vehicle is on buyer's watchlist
  try {
    await db.query<ResultSetHeader>(
      `INSERT INTO watchlist (id, user_id, vehicle_id)
       SELECT (SELECT COALESCE(MAX(w2.id), 0) + 1 FROM watchlist w2), ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM watchlist WHERE user_id = ? AND vehicle_id = ?
       )`,
      [bid.buyer_id, bid.vehicle_id, bid.buyer_id, bid.vehicle_id]
    );
  } catch (e) {
    console.error('[insertBuyerBid] Failed to upsert watchlist', e);
  }
  // After successful insert, set Redis key for realtime consumers
  try { 
    const redis = getRedis();
    const payload = {
      vehicleId: bid.vehicle_id,
      buyerId: bid.buyer_id,
      bidAmt: bid.bid_amt,
      isTopBidder: bid.top_bid_at_insert === 1,
      auctionEndDttm,
    };
  
    await redis.publish("vehicle:bid:update", JSON.stringify(payload));
    console.log("[Redis] Published vehicle:bid:update", payload);
  
  } catch (e) {
    console.error("[insertBuyerBid] Failed to publish Redis event vehicle:bid:update", e);
  }
  

  // Emit isWinning if this insertion became top (best-effort; losing will be handled by controller/runner where previous top is known)
  try {
    if (bid.top_bid_at_insert === 1) {
      const io = getIO();
      io.to(String(bid.buyer_id)).emit('isWinning', { vehicleId: bid.vehicle_id, auctionEndDttm });
    }
  } catch (e) {
    console.error('[insertBuyerBid] Failed Socket.IO emit isWinning', e);
  }
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

export interface BuyerLimitInfo {
  security_deposit: number;
  bid_limit: number;
  active_vehicle_bids: Array<{ vehicle_id: number; max_bidded: number }>;
  unpaid_vehicles: Array<{ vehicle_id: number; unpaid_amt: number }>;
  limit_used: number;
  pending_limit: number;
}

export async function getBuyerLimitInfo(buyerId: number): Promise<BuyerLimitInfo> {
  const db: Pool = getDb();
  
  // Get buyer's security deposit and bid limit
  const [buyerRows] = await db.query<RowDataPacket[]>(
    `SELECT security_deposit, bid_limit FROM buyers WHERE id = ?`,
    [buyerId]
  );
  
  if (buyerRows.length === 0) {
    throw new Error('Buyer not found');
  }
  
  const securityDeposit = Number(buyerRows[0]?.security_deposit) || 0;
  const bidLimit = Number(buyerRows[0]?.bid_limit) || 0;
  
  // Get unpaid amount from vehicles where buyer is top bidder and auction status is pending
  const [unpaidRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      v.vehicle_id,
      MAX(bb.bid_amt) as unpaid_amt
    FROM vehicles v
    JOIN buyer_bids bb ON v.vehicle_id = bb.vehicle_id
    WHERE v.top_bidder_id = ?
    AND v.auction_status_id IN (20, 30, 50, 70)
    AND bb.buyer_id = ?
    GROUP BY v.vehicle_id
  `, [buyerId, buyerId]);
  
  const unpaidVehicles = unpaidRows.map(row => ({
    vehicle_id: row.vehicle_id,
    unpaid_amt: Number(row.unpaid_amt)
  }));
  
  // Get current active bids (vehicles under auction)
  const [activeBidRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      v.vehicle_id,
      MAX(bb.bid_amt) as max_bidded
    FROM vehicles v
    JOIN buyer_bids bb ON v.vehicle_id = bb.vehicle_id
    WHERE bb.buyer_id = ?
    AND v.auction_status_id = 10
    GROUP BY v.vehicle_id
  `, [buyerId]);
  
  const activeVehicleBids = activeBidRows.map(row => ({
    vehicle_id: row.vehicle_id,
    max_bidded: Number(row.max_bidded)
  }));
  
  // Calculate totals
  const unpaidAmt = unpaidVehicles.reduce((sum, vehicle) => sum + vehicle.unpaid_amt, 0);
  const currentBidsSum = activeVehicleBids.reduce((sum, bid) => sum + bid.max_bidded, 0);
  const limitUsed = unpaidAmt + currentBidsSum;
  const pendingLimit = bidLimit - limitUsed;
  
  return {
    security_deposit: securityDeposit,
    bid_limit: bidLimit,
    active_vehicle_bids: activeVehicleBids,
    unpaid_vehicles: unpaidVehicles,
    limit_used: limitUsed,
    pending_limit: Math.max(0, pendingLimit) // Ensure non-negative
  };
}

export async function lockVehicleForUpdate(vehicleId: number): Promise<RowDataPacket | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT vehicle_id, max_price, base_price, top_bidder_id, auction_end_dttm
     FROM vehicles WHERE vehicle_id = ? FOR UPDATE`,
    [vehicleId]
  );
  return rows.length > 0 ? (rows[0] as RowDataPacket) : null;
}

export async function getCurrentMaxBidForVehicle(vehicleId: number): Promise<number> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(bid_amt), (SELECT base_price FROM vehicles WHERE vehicle_id = ?)) AS current_max
     FROM buyer_bids WHERE vehicle_id = ?`,
    [vehicleId, vehicleId]
  );
  return Number(rows[0]?.current_max) || 0;
}

export async function getBuyerCurrentMaxOnVehicle(buyerId: number, vehicleId: number): Promise<number> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(bid_amt), 0) AS buyer_current
     FROM buyer_bids WHERE vehicle_id = ? AND buyer_id = ?`,
    [vehicleId, buyerId]
  );
  return Number(rows[0]?.buyer_current) || 0;
}

export async function insertSurrogateBid(bid: BuyerBidRecord): Promise<number> {
  const db: Pool = getDb();
  const [res] = await db.query<ResultSetHeader>(
    `INSERT INTO ${BUYER_BIDS_TABLE} (vehicle_id, buyer_id, bid_amt, is_surrogate, bid_mode, top_bid_at_insert, created_dttm, user_id)
     VALUES (?, ?, ?, 1, 'A', 0, NOW(), 0)`,
    [bid.vehicle_id, bid.buyer_id, bid.bid_amt]
  );
  return res.insertId;
}

export async function clearTopBidFlags(vehicleId: number): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `UPDATE ${BUYER_BIDS_TABLE} SET top_bid_at_insert = 0 WHERE vehicle_id = ? AND top_bid_at_insert = 1`,
    [vehicleId]
  );
}

export async function setTopBidFlag(bidId: number): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `UPDATE ${BUYER_BIDS_TABLE} SET top_bid_at_insert = 1 WHERE bid_id = ?`,
    [bidId]
  );
}