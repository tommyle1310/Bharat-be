import { Pool, RowDataPacket } from "mysql2/promise";
import { getDb } from "../../config/database";
import { DEFAULT_IMAGES } from "../../utils/static-files";

// Pagination constants
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

export interface WishlistItem {
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
 * Get wishlist items with optional keyword search
 * @param buyerId - Buyer ID
 * @param businessVertical - Business vertical (A, B, or I)
 * @param limit - Maximum number of items to return
 * @param offset - Number of items to skip
 * @param filters - Optional filters for RC availability and fuel type
 * @param keyword - Optional search keyword to filter by vehicle details
 * @returns Array of wishlist items matching the search criteria and preferences
 */
export async function getWishlist(
  buyerId: number,
  businessVertical: 'A'|'B'|'I' = 'A',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  filters?: { rcAvailable?: string; vehicleFuel?: string },
  keyword?: string
): Promise<{ data: WishlistItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  const categoryFilter = businessVertical === 'I' ? ' AND v.vehicle_category_id = 10'
    : businessVertical === 'B' ? ' AND v.vehicle_category_id = 20'
    : '';

  const rcFilter = String(filters?.rcAvailable || '');
  const fuelFilter = String(filters?.vehicleFuel || '');

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
      (
        (CASE WHEN bvt.vehicletype_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN bsc.subcategory_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN bst.state_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN bsl.seller_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN bmk.make_id IS NULL THEN 0 ELSE 1 END)
      ) AS total_flags,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END AS has_bidded,
      CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN 'Winning' ELSE 'Losing' END AS bidding_status,
      CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END AS is_favorite
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN buyer_preference_vehicletype bvt
      ON bvt.vehicletype_id = v.vehicle_type_id AND bvt.buyer_id = ?
    LEFT JOIN buyer_preference_subcategory bsc
      ON bsc.subcategory_id = v.vehicle_subcategory_id AND bsc.buyer_id = ?
    LEFT JOIN buyer_preference_state bst
      ON bst.state_id = v.vehicle_state_id AND bst.buyer_id = ?
    LEFT JOIN buyer_preference_seller bsl
      ON bsl.seller_id = v.seller_id AND bsl.buyer_id = ?
    LEFT JOIN buyer_preference_make bmk
      ON bmk.make_id = v.vehicle_make_id AND bmk.buyer_id = ?
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
    LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?
    WHERE 1=1 ${categoryFilter} ${searchCondition}
    GROUP BY v.vehicle_id
    HAVING total_flags >= 4
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?`;

  const params = [
    MANAGER_IMG,
    buyerId,
    buyerId,
    buyerId,
    buyerId,
    buyerId,
    buyerId,
    buyerId,
    ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
    safePageSize,
    offset,
  ];
  try {
    console.log('=== getWishlist DEBUG ===');
    console.log('buyerId:', buyerId);
    console.log('businessVertical:', businessVertical);
    console.log('categoryFilter:', categoryFilter);
    console.log('filters.rcAvailable:', rcFilter);
    console.log('filters.vehicleFuel:', fuelFilter);
    console.log('keyword:', keyword);
    console.log('hasKeyword:', hasKeyword);
    console.log('searchCondition:', searchCondition);
    console.log('SQL:', sql);
    console.log('Params:', params);

    // Check what preferences exist for this buyer
    const [prefCheck] = await db.query<RowDataPacket[]>(`
      SELECT 
        'vehicletype' as table_name, COUNT(*) as count FROM buyer_preference_vehicletype WHERE buyer_id = ?
      UNION ALL
      SELECT 'make', COUNT(*) FROM buyer_preference_make WHERE buyer_id = ?
      UNION ALL  
      SELECT 'seller', COUNT(*) FROM buyer_preference_seller WHERE buyer_id = ?
      UNION ALL
      SELECT 'state', COUNT(*) FROM buyer_preference_state WHERE buyer_id = ?
      UNION ALL
      SELECT 'subcategory', COUNT(*) FROM buyer_preference_subcategory WHERE buyer_id = ?
    `, [buyerId, buyerId, buyerId, buyerId, buyerId]);
    console.log('Existing preferences for buyer', buyerId, ':', prefCheck);

    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    console.log('Raw rows count:', rows.length);
    if (rows.length) {
      console.log('Sample vehicle_ids:', rows.slice(0, 10).map(r => r.vehicle_id));
      // Also log total_flags if present in driver payload
      try { 
        console.log('Sample total_flags:', rows.slice(0, 5).map(r => (r as any).total_flags)); 
      } catch {}
    } else {
      console.log('No vehicles found. Checking if any vehicles exist at all...');
      const [allVehicles] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM vehicles');
      console.log('Total vehicles in database:', allVehicles);
      
      console.log('Checking vehicles with preferences...');
      const [vehiclesWithPrefs] = await db.query<RowDataPacket[]>(`
        SELECT v.vehicle_id, 
          (CASE WHEN bvt.vehicletype_id IS NULL THEN 0 ELSE 1 END) as vt_flag,
          (CASE WHEN bsc.subcategory_id IS NULL THEN 0 ELSE 1 END) as sc_flag,
          (CASE WHEN bst.state_id IS NULL THEN 0 ELSE 1 END) as st_flag,
          (CASE WHEN bsl.seller_id IS NULL THEN 0 ELSE 1 END) as sl_flag,
          (CASE WHEN bmk.make_id IS NULL THEN 0 ELSE 1 END) as mk_flag,
          (
            (CASE WHEN bvt.vehicletype_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN bsc.subcategory_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN bst.state_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN bsl.seller_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN bmk.make_id IS NULL THEN 0 ELSE 1 END)
          ) as total_flags
        FROM vehicles v
        LEFT JOIN buyer_preference_vehicletype bvt ON bvt.vehicletype_id = v.vehicle_type_id AND bvt.buyer_id = ?
        LEFT JOIN buyer_preference_subcategory bsc ON bsc.subcategory_id = v.vehicle_subcategory_id AND bsc.buyer_id = ?
        LEFT JOIN buyer_preference_state bst ON bst.state_id = v.vehicle_state_id AND bst.buyer_id = ?
        LEFT JOIN buyer_preference_seller bsl ON bsl.seller_id = v.seller_id AND bsl.buyer_id = ?
        LEFT JOIN buyer_preference_make bmk ON bmk.make_id = v.vehicle_make_id AND bmk.buyer_id = ?
        WHERE 1=1 ${categoryFilter}
        ORDER BY total_flags DESC
        LIMIT 10
      `, [buyerId, buyerId, buyerId, buyerId, buyerId]);
      console.log('Sample vehicles with preference flags:', vehiclesWithPrefs);
    }

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
      is_favorite: (r as any).is_favorite === 1,
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

    // Get total count for pagination
    const countSql = `
      SELECT COUNT(*) as total
      FROM (
        SELECT v.vehicle_id,
          MAX(CASE WHEN bvt.buyer_id IS NULL THEN 0 ELSE 1 END) AS vt_flag,
          MAX(CASE WHEN bsc.buyer_id IS NULL THEN 0 ELSE 1 END) AS sc_flag,
          MAX(CASE WHEN bst.buyer_id IS NULL THEN 0 ELSE 1 END) AS st_flag,
          MAX(CASE WHEN bsl.buyer_id IS NULL THEN 0 ELSE 1 END) AS sl_flag,
          MAX(CASE WHEN bmk.buyer_id IS NULL THEN 0 ELSE 1 END) AS mk_flag
        FROM vehicles v
        LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
        LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
        LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
        LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
        LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
        LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
        LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
        LEFT JOIN buyer_preference_vehicletype bvt
          ON bvt.vehicletype_id = v.vehicle_type_id AND bvt.buyer_id = ?
        LEFT JOIN buyer_preference_subcategory bsc
          ON bsc.subcategory_id = v.vehicle_subcategory_id AND bsc.buyer_id = ?
        LEFT JOIN buyer_preference_state bst
          ON bst.state_id = v.vehicle_state_id AND bst.buyer_id = ?
        LEFT JOIN buyer_preference_seller bsl
          ON bsl.seller_id = v.seller_id AND bsl.buyer_id = ?
        LEFT JOIN buyer_preference_make bmk
          ON bmk.make_id = v.vehicle_make_id AND bmk.buyer_id = ?
        WHERE 1=1 ${categoryFilter} ${searchCondition}
        GROUP BY v.vehicle_id
        HAVING (vt_flag + sc_flag + st_flag + sl_flag + mk_flag) >= 4
      ) as filtered_vehicles
    `;

    const countParams = [
      buyerId,
      buyerId,
      buyerId,
      buyerId,
      buyerId,
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : [])
    ];

    const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
    const total = countRows[0]?.total || 0;

    return {
      data,
      total,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize)
    };
  } catch (e) {
    console.error('getWishlist ERROR:', (e as any)?.message || e);
    throw e;
  }
}

export interface UpdatePreferencesInput {
  buyerId: number;
  businessVertical: 'A'|'B'|'I';
  vehicleType: string; // csv
  vehicleFuel: string; // csv (not stored, only used for filter)
  ownership: string; // not stored here
  rcAvailable: string; // not stored here
  sellerId: string; // csv
  stateIds?: string; // csv
  makeIds?: string; // csv
  subcategoryIds?: string; // csv
  categoryId?: string; // specific category ID to use instead of businessVertical mapping
}

function mapBusinessVerticalToCategoryId(bv: 'A'|'B'|'I'): number {
  if (bv === 'I') return 10;
  if (bv === 'B') return 20;
  return 0;
}

function parseCsvIds(csv?: string): number[] {
  if (!csv) return [];
  return String(csv)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n) && n > 0);
}

export async function updateWishlistPreferences(input: UpdatePreferencesInput) {
  const db = getDb();
  
  // Use specific categoryId if provided, otherwise derive from businessVertical
  let categoryIds: number[];
  if (input.categoryId && input.categoryId.trim()) {
    categoryIds = parseCsvIds(input.categoryId);
    if (categoryIds.length === 0) {
      throw new Error('Invalid categoryId provided');
    }
  } else {
    categoryIds = [mapBusinessVerticalToCategoryId(input.businessVertical)];
  }

  const vehicleTypeIds = parseCsvIds(input.vehicleType);
  const makeIds = parseCsvIds(input.makeIds);
  const sellerIds = parseCsvIds(input.sellerId);
  const stateIds = parseCsvIds(input.stateIds);
  const subcategoryIds = parseCsvIds(input.subcategoryIds);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Toggleable logic: Check if preference exists, if yes delete, if no insert
    async function togglePreference(table: string, column: string, ids: number[]) {
      if (!ids.length) return 0;
      
      let operations = 0;
      for (const id of ids) {
        for (const categoryId of categoryIds) {
          // Check if preference exists
          const [existing] = await connection.query<RowDataPacket[]>(
            `SELECT id FROM ${table} WHERE buyer_id = ? AND ${column} = ? AND category_id = ?`,
            [input.buyerId, id, categoryId]
          );

          if (existing.length > 0) {
            // Delete existing preference (toggle off)
            await connection.query(
              `DELETE FROM ${table} WHERE buyer_id = ? AND ${column} = ? AND category_id = ?`,
              [input.buyerId, id, categoryId]
            );
            operations--;
          } else {
            // Insert new preference (toggle on)
            await connection.query(
              `INSERT INTO ${table} (id, buyer_id, ${column}, category_id, is_surrogate, updated_dttm) VALUES (0, ?, ?, ?, 0, NOW())`,
              [input.buyerId, id, categoryId]
            );
            operations++;
          }
        }
      }
      return operations;
    }

    const vehicletypeOps = await togglePreference('buyer_preference_vehicletype', 'vehicletype_id', vehicleTypeIds);
    const makeOps = await togglePreference('buyer_preference_make', 'make_id', makeIds);
    const sellerOps = await togglePreference('buyer_preference_seller', 'seller_id', sellerIds);
    const stateOps = await togglePreference('buyer_preference_state', 'state_id', stateIds);
    const subcategoryOps = await togglePreference('buyer_preference_subcategory', 'subcategory_id', subcategoryIds);

    await connection.commit();
    return {
      vehicletype: vehicletypeOps,
      make: makeOps,
      seller: sellerOps,
      state: stateOps,
      subcategory: subcategoryOps,
    };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export interface WishlistConfiguration {
  state: number[];
  seller: number[];
  subcategory: number[];
  vehicleType: number[];
  make: number[];
}

export async function getWishlistConfiguration(buyerId: number): Promise<WishlistConfiguration> {
  const db: Pool = getDb();
  
  // Get all preference IDs for the buyer
  const [vehicleTypeRows] = await db.query<RowDataPacket[]>(`
    SELECT vehicletype_id FROM buyer_preference_vehicletype WHERE buyer_id = ?
  `, [buyerId]);

  const [makeRows] = await db.query<RowDataPacket[]>(`
    SELECT make_id FROM buyer_preference_make WHERE buyer_id = ?
  `, [buyerId]);

  const [sellerRows] = await db.query<RowDataPacket[]>(`
    SELECT seller_id FROM buyer_preference_seller WHERE buyer_id = ?
  `, [buyerId]);

  const [stateRows] = await db.query<RowDataPacket[]>(`
    SELECT state_id FROM buyer_preference_state WHERE buyer_id = ?
  `, [buyerId]);

  const [subcategoryRows] = await db.query<RowDataPacket[]>(`
    SELECT subcategory_id FROM buyer_preference_subcategory WHERE buyer_id = ?
  `, [buyerId]);

  return {
    state: stateRows.map(row => row.state_id),
    seller: sellerRows.map(row => row.seller_id),
    subcategory: subcategoryRows.map(row => row.subcategory_id),
    vehicleType: vehicleTypeRows.map(row => row.vehicletype_id),
    make: makeRows.map(row => row.make_id),
  };
}

