import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { DEFAULT_IMAGES } from "../../utils/static-files";

// Pagination constants
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

export async function addToWatchlist(userId: number, vehicleId: number): Promise<void> {
  const db: Pool = getDb();
  // Generate explicit id since table may not be AUTO_INCREMENT
  await db.query<ResultSetHeader>(
    `INSERT INTO watchlist (id, user_id, vehicle_id)
     SELECT (SELECT COALESCE(MAX(w2.id), 0) + 1 FROM watchlist w2), ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM watchlist WHERE user_id = ? AND vehicle_id = ?
     )`,
    [userId, vehicleId, userId, vehicleId]
  );
}

export async function toggleWatchlist(userId: number, vehicleId: number): Promise<{ is_favorite: boolean; locked: boolean; }> {
  const db: Pool = getDb();

  // If buyer has already bid on this vehicle, ensure watchlist exists and do not allow unfavorite
  const [bidRows] = await db.query<RowDataPacket[]>(
    `SELECT 1 FROM buyer_bids WHERE buyer_id = ? AND vehicle_id = ? LIMIT 1`,
    [userId, vehicleId]
  );
  const hasBid = bidRows.length > 0;

  if (hasBid) {
    await addToWatchlist(userId, vehicleId);
    return { is_favorite: true, locked: true };
  }

  // No bid yet, toggle watchlist
  const [wlRows] = await db.query<RowDataPacket[]>(
    `SELECT 1 FROM watchlist WHERE user_id = ? AND vehicle_id = ? LIMIT 1`,
    [userId, vehicleId]
  );
  const exists = wlRows.length > 0;

  if (exists) {
    await db.query<ResultSetHeader>(
      `DELETE FROM watchlist WHERE user_id = ? AND vehicle_id = ?`,
      [userId, vehicleId]
    );
    return { is_favorite: false, locked: false };
  } else {
    await db.query<ResultSetHeader>(
      `INSERT INTO watchlist (id, user_id, vehicle_id)
       VALUES ((SELECT COALESCE(MAX(w2.id), 0) + 1 FROM watchlist w2), ?, ?)`,
      [userId, vehicleId]
    );
    return { is_favorite: true, locked: false };
  }
}

export interface WatchlistItem {
  vehicle_id: string;
  end_time: string | null;
  odometer: string | null;
  fuel: string | null;
  owner_serial: string | null;
  state_code?: string | null;
  has_bidded: boolean;
  img_extension: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  transmissionType: string | null;
  rc_availability: boolean | null;
  repo_date: string | null;
  regs_no?: string | null;
  is_favorite: boolean;
  manufacture_year: string | null;
  vehicleId: number;
  imgIndex: number;
  bidding_status: string | null;
  bid_amount: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  manager_image: string | null;
  manager_id: string | null;
}

/**
 * Get watchlist items with optional keyword search
 * @param userId - Buyer ID
 * @param limit - Maximum number of items to return
 * @param offset - Number of items to skip
 * @param keyword - Optional search keyword to filter by vehicle details
 * @returns Array of watchlist items matching the search criteria
 */
export async function getWatchlist(
  userId: number, 
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  keyword?: string
): Promise<{ data: WatchlistItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  // Sanitize keyword input
  const safeKeyword = keyword ? `%${String(keyword).trim()}%` : null;
  const hasKeyword = keyword && keyword.trim().length > 0;

  // Build search condition
  const searchCondition = hasKeyword ? `
    AND (
      v.manufacturing_year LIKE ?
      OR mk.make_name LIKE ?
      OR md.model_name LIKE ?
      OR vv.variant_name LIKE ?
      OR ft.fuel_type LIKE ?
      OR st.staff LIKE ?
      OR st.phone LIKE ?
    )
  ` : '';

  const sql = `
    SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      v.regs_no AS regs_no,
      COALESCE(v.vehicle_image_id, 1) AS img_index,
      ft.fuel_type AS fuel,
      tt.transmission_name AS transmissionType,
      v.rc_availability,
      v.repo_date,
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
      v.added_on,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END AS has_bidded,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN 'Winning' ELSE 'Losing' END AS bidding_status
    FROM watchlist w
    INNER JOIN vehicles v ON v.vehicle_id = w.vehicle_id AND w.user_id = ?
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id
    WHERE 1=1 ${searchCondition}
    GROUP BY v.vehicle_id
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?`;

  // Get total count first
  const countSql = `
    SELECT COUNT(*) as total
    FROM watchlist w
    INNER JOIN vehicles v ON v.vehicle_id = w.vehicle_id AND w.user_id = ?
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    WHERE 1=1 ${searchCondition}
  `;

  const countParams = [
    userId,
    ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : [])
  ];

  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
  const total = countRows[0]?.total || 0;

  // Prepare parameters
  const params = [
    MANAGER_IMG,
    userId,
    userId,
    ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
    safePageSize,
    offset,
  ];

  const [rows] = await db.query<RowDataPacket[]>(sql, params);

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
    transmissionType: r.transmissionType ?? null,
    rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
    repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
    regs_no: r.regs_no ?? null,
    is_favorite: true,
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
  }));

  return {
    data,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}


