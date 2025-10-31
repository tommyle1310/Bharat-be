import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { Vehicle } from "./vehicle.model";
import { getDataFileUrl, DEFAULT_IMAGES } from "../../utils/static-files";

const TABLE = "vehicles";

// Pagination constants
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

export async function listVehicles(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<{ data: Vehicle[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;
  
  // Get total count
  const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM ${TABLE}`);
  const total = countRows[0]?.total || 0;
  
  // Get paginated data
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${TABLE} ORDER BY vehicle_id DESC LIMIT ? OFFSET ?`,
    [safePageSize, offset]
  );
  
  return {
    data: rows as unknown as Vehicle[],
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
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
  const [res] = await db.query<ResultSetHeader>(`INSERT INTO ${TABLE} SET ?`, [
    data,
  ]);
  return res.insertId;
}

export async function updateVehicle(
  id: number,
  data: Partial<Vehicle>
): Promise<boolean> {
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

export async function updateVehicleBidderInfo(
  vehicleId: number,
  topBidderId: number | null
): Promise<boolean> {
  const db: Pool = getDb();
  
  // First, get the current bidders_count
  const [currentRows] = await db.query<RowDataPacket[]>(
    `SELECT bidders_count FROM ${TABLE} WHERE vehicle_id = ?`,
    [vehicleId]
  );
  
  if (currentRows.length === 0) {
    return false;
  }
  
  const currentBiddersCount = currentRows[0]?.bidders_count || 0;
  const newBiddersCount = currentBiddersCount + 1;
  
  // Update both bidders_count and top_bidder_id
  const [res] = await db.query<ResultSetHeader>(
    `UPDATE ${TABLE} SET bidders_count = ?, top_bidder_id = ? WHERE vehicle_id = ?`,
    [newBiddersCount, topBidderId, vehicleId]
  );
  
  return res.affectedRows > 0;
}

export interface VehicleGroupItem {
  id: string;
  type: "state" | "auction_status" | "all";
  title: string;
  total_vehicles: string;
}

export async function getGroups(businessVertical: 'A'|'B'|'I' = 'A'): Promise<VehicleGroupItem[]> {
  const db: Pool = getDb();

  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL

  const REGIONS = ["North", "South", "East", "West"];
  const now = new Date();

  // Count expression per business vertical (do NOT filter rows; only change how we count)
  const totalExpr = businessVertical === 'I'
    ? 'SUM(CASE WHEN v.vehicle_category_id = 10 THEN 1 ELSE 0 END)'
    : businessVertical === 'B'
      ? 'SUM(CASE WHEN v.vehicle_category_id = 20 THEN 1 ELSE 0 END)'
      : 'COUNT(v.vehicle_id)';

  // Count per region; groups remain unchanged, counts vary by businessVertical
  const [regionRows] = await db.query<RowDataPacket[]>(
    `SELECT s.region AS region, ${totalExpr} AS total
     FROM states s
     LEFT JOIN vehicles v 
       ON v.vehicle_state_id = s.id
     WHERE s.region IS NOT NULL
     GROUP BY s.region`
  );

  const regionMap: Record<string, number> = {};
  for (const r of regionRows) {
    if (r.region) regionMap[r.region] = Number(r.total) || 0;
  }

  const stateItems: VehicleGroupItem[] = REGIONS.map((region, index) => ({
    id: String(index + 1),
    type: "state",
    title: region,
    total_vehicles: String(regionMap[region] ?? 0),
  }));

  // Auction status via case_options; do NOT filter out statuses
  const [statusRows] = await db.query<RowDataPacket[]>(
    `SELECT co.id AS id, co.case_name AS name, ${totalExpr} AS total
     FROM case_options co
     LEFT JOIN vehicles v 
       ON v.case_option_id = co.id
     GROUP BY co.id, co.case_name
     ORDER BY co.id`
  );

  const statusItems: VehicleGroupItem[] = statusRows.map((r) => ({
    id: String(r.id),
    type: "auction_status",
    title: String(r.name),
    total_vehicles: String(r.total),
  }));

  // Total vehicles; counts vary by businessVertical
  const [allRows] = await db.query<RowDataPacket[]>(
    `SELECT ${businessVertical === 'I' ? 'SUM(CASE WHEN v.vehicle_category_id = 10 THEN 1 ELSE 0 END)'
      : businessVertical === 'B' ? 'SUM(CASE WHEN v.vehicle_category_id = 20 THEN 1 ELSE 0 END)'
      : 'COUNT(v.vehicle_id)'} AS total_all FROM vehicles v`
  );

  const total_all = allRows?.[0]?.total_all ?? 0;

  const allItem: VehicleGroupItem = {
    id: "0",
    type: "all",
    title: "All",
    total_vehicles: String(total_all),
  };

  return [...stateItems, ...statusItems, allItem];
}

export interface VehicleItem {
  vehicle_id: number;
  regs_no: string | null;
  manufacturing_year: string | null;
  base_price: number | null;
  max_price: number | null;
  vehicle_location: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  is_favorite: boolean;
  vehicle_variant: string | null;
  fuel_type: string | null;
  transmissionType: string | null;
  rc_availability: boolean | null;
  repo_date: string | null;
  staff_name: string | null;
  staff_phone: string | null;
  has_bidded?: boolean;
}

export interface VehicleListItem {
  vehicle_id: string;
  end_time: string | null;
  odometer: string | null;
  fuel: string | null;
  owner_serial: string | null;
  state_code?: string | null;
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
  has_bidded?: boolean;
  yard_contact_person_name?: string | null;
  contact_person_contact_no?: string | null;
  yard_address?: string | null;
  yard_address_zip?: string | null;
  yard_city?: string | null;
  yard_state?: string | null;
}

export async function searchVehicles(
  keyword: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: VehicleListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;
  const hasKeyword = Boolean(keyword && keyword.trim().length > 0);
  const safeKeyword = `%${String(keyword || '').trim()}%`;

  const join = `
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
  `;

  const searchCondition = hasKeyword ? `(
      v.manufacturing_year LIKE ?
      OR mk.make_name LIKE ?
      OR md.model_name LIKE ?
      OR vv.variant_name LIKE ?
      OR ft.fuel_type LIKE ?
      OR st.staff LIKE ?
      OR st.phone LIKE ?
    )` : '1=1';

  const bucketFilter = businessVertical === 'B' && bucketId ? ' AND v.bucket_id = ? AND v.vehicle_category_id = 20' : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM vehicles v
    ${join}
    WHERE ${searchCondition} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
  `;

  const countParams = [
    ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
    ...(bucketFilter ? [bucketId as number] : [])
  ];

  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
  const total = countRows[0]?.total || 0;

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
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN \'Winning\' ELSE \'Losing\' END' : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    ${join}
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE ${searchCondition} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
    GROUP BY v.vehicle_id
    ORDER BY v.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  const params = [
    MANAGER_IMG,
    ...(buyerId ? [buyerId, buyerId] as any[] : []),
    ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] as any[] : []),
    ...(bucketFilter ? [bucketId as number] as any[] : []),
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
    img_extension: r.img_extension ?? null,
    variant: r.variant ?? null,
    transmissionType: r.transmissionType ?? null,
    rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
    repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
    regs_no: r.regs_no ?? null,
    manufacture_year: r.manufacture_year ?? null,
    vehicleId: r.vehicle_id,
    imgIndex: Number((r as any).img_index) || 1,
    bidding_status: r.bidding_status ?? null,
    bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
    manager_name: r.manager_name ?? null,
    manager_phone: r.manager_phone ?? null,
    manager_email: r.manager_email ?? null,
    manager_image: r.manager_image ?? MANAGER_IMG,
    manager_id: r.manager_id != null ? String(r.manager_id) : null,
    is_favorite: (r as any).is_favorite === 1,
  })) as VehicleListItem[];

  return {
    data,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}

export async function getVehiclesByGroup(
  type: "state" | "auction_status" | "all",
  title: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: VehicleListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  // Use static file serving for images
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  // sanitize inputs
  const safeTitle = String(title || "").trim();

  let where = "";
  let join = "";
  let categoryFilter = "";
  if (businessVertical === 'I') {
    categoryFilter = " AND v.vehicle_category_id = 10";
  } else if (businessVertical === 'B') {
    categoryFilter = " AND v.vehicle_category_id = 20";
  }

  if (type === "auction_status") {
    join = `
      LEFT JOIN case_options co ON co.id = v.case_option_id
      LEFT JOIN states s ON s.id = v.vehicle_state_id
    `;
    where = "LOWER(TRIM(co.case_name)) = LOWER(?)" + categoryFilter;
  } else if (type === "state") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.case_option_id
    `;
    where = "LOWER(TRIM(s.region)) = LOWER(?)" + categoryFilter;
  } else if (type === "all") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.case_option_id
    `;
    where = "1=1" + categoryFilter;
  }

  const bucketFilter = businessVertical === 'B' && bucketId ? ' AND v.bucket_id = ?' : '';

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
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN \'Winning\' ELSE \'Losing\' END' : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    ${join}
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE ${where} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
    GROUP BY v.vehicle_id
    ORDER BY v.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  // Get total count first
  const countSql = `
    SELECT COUNT(*) as total
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    ${join}
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    WHERE ${where} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
  `;

  let countParams: any[];
  if (type === "all") {
    countParams = [];
  } else {
    countParams = [safeTitle];
  }

  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
  const total = countRows[0]?.total || 0;

  let params: any[];

  if (type === "all") {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, ...(bucketFilter ? [bucketId as number] : []), safePageSize, offset] : [MANAGER_IMG, ...(bucketFilter ? [bucketId as number] : []), safePageSize, offset];
  } else {
    // Order must match: manager_image, bb.buyer_id, w.user_id, title, (optional bucketId), limit, offset
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, safeTitle, ...(bucketFilter ? [bucketId as number] : []), safePageSize, offset] : [MANAGER_IMG, safeTitle, ...(bucketFilter ? [bucketId as number] : []), safePageSize, offset];
  }

  console.log('=== getVehiclesByGroup DEBUG ===');
  console.log('SQL:', sql);
  console.log('Params:', params);
  console.log('buyerId:', buyerId);
  console.log('type:', type);
  console.log('title:', title);
  
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  console.log('Raw rows count:', rows.length);
  console.log('Raw rows:', rows.map(r => ({ vehicle_id: r.vehicle_id, buyer_id: (r as any).buyer_id, top_bid_at_insert: (r as any).top_bid_at_insert })));
  
  const result = rows.map((r) => ({
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
  
  console.log('Final result count:', result.length);
  console.log('Final result vehicle_ids:', result.map(r => r.vehicle_id));
  console.log('=== END getVehiclesByGroup DEBUG ===');
  
  return {
    data: result,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}

export async function searchVehiclesByGroup(
  keyword: string,
  type: "state" | "auction_status" | "all",
  title: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: VehicleListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  // Default image URLs
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  // Sanitize inputs
  const safeKeyword = `%${String(keyword || "").trim()}%`;
  const safeTitle = String(title || "").trim();

  // Build WHERE and JOIN clauses based on type
  let where = "";
  let join = `
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.case_option_id
  `;

  let categoryFilter = "";
  if (businessVertical === 'I') {
    categoryFilter = " AND v.vehicle_category_id = 10";
  } else if (businessVertical === 'B') {
    categoryFilter = " AND v.vehicle_category_id = 20";
  }

  if (type === "auction_status") {
    where = `LOWER(TRIM(co.case_name)) = LOWER(?)` + categoryFilter;
  } else if (type === "state") {
    where = `LOWER(TRIM(s.region)) = LOWER(?)` + categoryFilter;
  } else if (type === "all") {
    where = "1=1" + categoryFilter;
  } else {
    where = "1=1" + categoryFilter; // Default case
  }

  const bucketFilter = businessVertical === 'B' && bucketId ? ' AND v.bucket_id = ?' : '';

  // Combine keyword search with type/title filter (only if keyword is provided)
  const hasKeyword = keyword && keyword.trim().length > 0;
  const searchCondition = hasKeyword ? `
    (
      v.manufacturing_year LIKE ?
      OR mk.make_name LIKE ?
      OR md.model_name LIKE ?
      OR vv.variant_name LIKE ?
      OR ft.fuel_type LIKE ?
      OR st.staff LIKE ?
      OR st.phone LIKE ?
    )
  ` : '1=1';

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
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN \'Winning\' ELSE \'Losing\' END' : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    ${join}
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE ${where} AND ${searchCondition} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
    GROUP BY v.vehicle_id
    ORDER BY v.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  // Get total count first
  const countSql = `
    SELECT COUNT(*) as total
    FROM vehicles v
    ${join}
    WHERE ${where} AND ${searchCondition} AND v.auction_end_dttm > NOW() AND v.auction_status_id = 10${bucketFilter}
  `;

  let countParams: any[];
  if (type === "all") {
    countParams = [
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      ...(bucketFilter ? [bucketId as number] : [])
    ];
  } else {
    countParams = [
      safeTitle,
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      ...(bucketFilter ? [bucketId as number] : [])
    ];
  }

  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
  const total = countRows[0]?.total || 0;

  // Prepare query parameters
  let params: any[];
  if (type === "all") {
    // For "all" type, no title parameter is needed since where = "1=1"
    params = [
      MANAGER_IMG,
      ...(buyerId ? [buyerId, buyerId] : []),
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      ...(bucketFilter ? [bucketId as number] : []),
      safePageSize,
      offset,
    ];
  } else {
    // For "state" and "auction_status" types, title parameter is needed
    params = [
      MANAGER_IMG,
      ...(buyerId ? [buyerId, buyerId] : []),
      safeTitle,
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      ...(bucketFilter ? [bucketId as number] : []),
      safePageSize,
      offset,
    ];
  }

  try {
    console.log('=== searchVehiclesByGroup DEBUG ===');
    console.log('SQL:', sql);
    console.log('Params:', params);
    console.log('buyerId:', buyerId);
    console.log('type:', type);
    console.log('title:', title);
    console.log('keyword:', keyword);
    console.log('hasKeyword:', hasKeyword);
    console.log('where:', where);
    console.log('searchCondition:', searchCondition);
    
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    console.log('Raw rows count:', rows.length);
    console.log('Raw rows:', rows.map(r => ({ vehicle_id: r.vehicle_id, buyer_id: (r as any).buyer_id, top_bid_at_insert: (r as any).top_bid_at_insert })));
    
    const result = rows.map((r) => ({
      vehicle_id: String(r.vehicle_id),
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
      odometer: r.odometer != null ? String(r.odometer) : null,
      fuel: r.fuel ?? null,
      owner_serial: r.ownership_serial ?? null,
      state_code: typeof r.regs_no === 'string' && r.regs_no.length >= 2 ? r.regs_no.substring(0,2) : null,
      has_bidded: (r as any).has_bidded === 1,
      make: r.make ?? null,
      model: r.model ?? null,
      img_extension: r.img_extension ?? null,
      variant: r.variant ?? null,
      transmissionType: r.transmissionType ?? null,
      rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
      repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
      regs_no: r.regs_no ?? null,
      manufacture_year: r.manufacture_year ?? null,
      vehicleId: r.vehicle_id,
      imgIndex: Number((r as any).img_index) || 1,
      bidding_status: r.bidding_status ?? null,
      bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
      manager_name: r.manager_name ?? null,
      manager_phone: r.manager_phone ?? null,
      manager_email: r.manager_email ?? null,
      manager_image: r.manager_image ?? MANAGER_IMG,
      manager_id: r.manager_id != null ? String(r.manager_id) : null,
      is_favorite: (r as any).is_favorite === 1,
    }));
    
    console.log('Final result count:', result.length);
    console.log('Final result vehicle_ids:', result.map(r => r.vehicle_id));
    console.log('=== END searchVehiclesByGroup DEBUG ===');
    
    return {
      data: result,
      total,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize)
    };
  } catch (error: any) {
    console.error("[searchVehiclesByGroup] Error:", error.message);
    throw error;
  }
}

export async function getVehicleDetails(
  vehicleId: number,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<VehicleListItem | null> {
  const db: Pool = getDb();
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  const bucketFilter = businessVertical === 'B' && bucketId ? ' AND v.bucket_id = ? AND v.vehicle_category_id = 20' : '';

  const sql = `SELECT
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
      v.yard_contact_person_name,
      v.contact_person_contact_no,
      v.yard_address,
      yc.city AS yard_city,
      ys.state AS yard_state,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN \'Winning\' ELSE \'Losing\' END' : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN cities yc ON yc.city_id = v.yard_city_id
    LEFT JOIN states ys ON ys.id = v.yard_state_id
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE v.vehicle_id = ? AND v.auction_status_id = 10${bucketFilter}
    GROUP BY v.vehicle_id
    LIMIT 1`;

  const params = buyerId
    ? [MANAGER_IMG, buyerId, buyerId, vehicleId, ...(bucketFilter ? [bucketId as number] : [])]
    : [MANAGER_IMG, vehicleId, ...(bucketFilter ? [bucketId as number] : [])];
  
  const [rows] = await db.query<RowDataPacket[]>(sql, params);

  if (rows.length === 0) {
    return null;
  }

  const r = rows[0] as RowDataPacket;
  return {
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
    yard_contact_person_name: (r as any).yard_contact_person_name ?? null,
    contact_person_contact_no: (r as any).contact_person_contact_no ?? null,
    yard_address: (r as any).yard_address ?? null,
    yard_city: (r as any).yard_city ?? null,
    yard_state: (r as any).yard_state ?? null,
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
  };
}

export async function filterVehiclesByGroup(
  type: "state" | "auction_status" | "all",
  title: string,
  vehicleType: string,
  vehicleFuel: string,
  ownership: string,
  rcAvailable: string,
  state: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: VehicleListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE;
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  const safeTitle = String(title || "").trim();

  let where = "";
  let join = `
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.case_option_id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN ownership_serial os ON os.ownership_id = CAST(v.ownership_serial AS UNSIGNED)
  `;

  let categoryFilter = "";
  if (businessVertical === 'I') {
    categoryFilter = " AND v.vehicle_category_id = 10";
  } else if (businessVertical === 'B') {
    categoryFilter = " AND v.vehicle_category_id = 20";
  }

  if (type === "auction_status") {
    where = `LOWER(TRIM(co.case_name)) = LOWER(?)` + categoryFilter;
  } else if (type === "state") {
    where = `LOWER(TRIM(s.region)) = LOWER(?)` + categoryFilter;
  } else if (type === "all") {
    where = "1=1" + categoryFilter;
  }

  const filterConditions: string[] = [];
  const filterParams: any[] = [];

  // Vehicle type filter
  if (vehicleType && vehicleType.trim()) {
    const typeIds = vehicleType
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
    if (typeIds.length > 0) {
      filterConditions.push(
        `v.vehicle_type_id IN (${typeIds.map(() => "?").join(",")})`
      );
      filterParams.push(...typeIds);
    }
  }

  // Fuel type filter
  if (vehicleFuel && vehicleFuel.trim()) {
    const fuelIds = vehicleFuel
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
    if (fuelIds.length > 0) {
      filterConditions.push(
        `v.fuel_type_id IN (${fuelIds.map(() => "?").join(",")})`
      );
      filterParams.push(...fuelIds);
    }
  }

  // Ownership filter (fixed)
  if (ownership && ownership.trim()) {
    const ownershipIds = ownership
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
    if (ownershipIds.length > 0) {
      filterConditions.push(
        `os.ownership_id IN (${ownershipIds.map(() => "?").join(",")})`
      );
      filterParams.push(...ownershipIds);
    }
  }

  // RC availability filter
  if (rcAvailable && rcAvailable.trim()) {
    if (rcAvailable.toLowerCase() === "true") {
      filterConditions.push("v.rc_availability = 1");
    } else if (rcAvailable.toLowerCase() === "false") {
      filterConditions.push("v.rc_availability = 0");
    }
  }

  // State/Region filter
  if (state && state.trim()) {
    const stateValue = state.trim();
    // Check if it's a region (North, West, South, East) or specific state
    if (['north', 'west', 'south', 'east'].includes(stateValue.toLowerCase())) {
      filterConditions.push("LOWER(TRIM(s.region)) = LOWER(TRIM(?))");
      filterParams.push(stateValue);
    } else {
      // Assume it's a specific state name
      filterConditions.push("LOWER(TRIM(s.state)) = LOWER(TRIM(?))");
      filterParams.push(stateValue);
    }
  }

  const allConditions = [where];
  if (filterConditions.length > 0) {
    allConditions.push(...filterConditions);
  }
  allConditions.push("v.auction_end_dttm > NOW()", "v.auction_status_id = 10");
  if (businessVertical === 'B' && bucketId) {
    allConditions.push("v.bucket_id = ?", "v.vehicle_category_id = 20");
    filterParams.push(bucketId);
  }
  const whereClause = allConditions.join(" AND ");

  const sql = `
    SELECT
      v.vehicle_id,
      MAX(v.auction_end_dttm) AS end_time,
      MAX(v.odometer_reading) AS odometer,
      MAX(ft.fuel_type) AS fuel,
      MAX(v.vehicle_image_id) AS vehicle_image_id,
      MAX(tt.transmission_name) AS transmissionType,
      MAX(v.rc_availability) AS rc_availability,
      MAX(v.repo_date) AS repo_date,
      MAX(os.ownership) AS ownership_label,
      MAX(mk.make_name) AS make,
      MAX(vmi.img_extension) AS img_extension,
      MAX(md.model_name) AS model,
      MAX(vv.variant_name) AS variant,
      MAX(v.manufacturing_year) AS manufacture_year,
      MAX(COALESCE(v.expected_price, v.base_price)) AS bid_amount,
      MAX(st.staff) AS manager_name,
      MAX(st.phone) AS manager_phone,
      MAX(st.email) AS manager_email,
      MAX(st.staff_id) AS manager_id,
      ? AS manager_image,
      MAX(v.regs_no) AS regs_no,
      MAX(v.added_on) AS added_on,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN \'Winning\' ELSE \'Losing\' END' : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    ${join}
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE ${whereClause}
    GROUP BY v.vehicle_id
    ORDER BY v.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  // Get total count first
  const countSql = `
    SELECT COUNT(*) as total
    FROM vehicles v
    ${join}
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    WHERE ${whereClause}
  `;

  let countParams: any[];
  if (type === "all") {
    countParams = [...filterParams];
  } else {
    countParams = [safeTitle, ...filterParams];
  }

  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams);
  const total = countRows[0]?.total || 0;

  let params: any[];
  if (type === "all") {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, ...filterParams, safePageSize, offset] : [MANAGER_IMG, ...filterParams, safePageSize, offset];
  } else {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, safeTitle, ...filterParams, safePageSize, offset] : [MANAGER_IMG, safeTitle, ...filterParams, safePageSize, offset];
  }

  try {
    console.log('=== filterVehiclesByGroup DEBUG ===');
    console.log('SQL:', sql);
    console.log('Params:', params);
    console.log('buyerId:', buyerId);
    console.log('type:', type);
    console.log('title:', title);
    console.log('vehicleType:', vehicleType);
    console.log('vehicleFuel:', vehicleFuel);
    console.log('ownership:', ownership);
    console.log('rcAvailable:', rcAvailable);
    console.log('whereClause:', whereClause);
    console.log('filterParams:', filterParams);
    
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    console.log('Raw rows count:', rows.length);
    console.log('Raw rows:', rows.map(r => ({ vehicle_id: r.vehicle_id, buyer_id: (r as any).buyer_id, top_bid_at_insert: (r as any).top_bid_at_insert })));
    
    const result = rows.map((r) => ({
      vehicle_id: String(r.vehicle_id),
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
      odometer: r.odometer != null ? String(r.odometer) : null,
      fuel: r.fuel ?? null,
      owner_serial: r.ownership_label ?? null,
      state_code: typeof r.regs_no === 'string' && r.regs_no.length >= 2 ? r.regs_no.substring(0,2) : null,
      has_bidded: (r as any).has_bidded === 1,
      make: r.make ?? null,
      model: r.model ?? null,
      img_extension: r.img_extension ?? null,
      variant: r.variant ?? null,
      transmissionType: r.transmissionType ?? null,
      rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
      repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
      regs_no: r.regs_no ?? null,
      manufacture_year: r.manufacture_year ?? null,
      vehicleId: r.vehicle_id,
      imgIndex: r.vehicle_image_id ?? 1,
      bidding_status: r.bidding_status ?? null,
      bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
      manager_name: r.manager_name ?? null,
      manager_phone: r.manager_phone ?? null,
      manager_email: r.manager_email ?? null,
      manager_image: r.manager_image ?? MANAGER_IMG,
      manager_id: r.manager_id != null ? String(r.manager_id) : null,
      is_favorite: (r as any).is_favorite === 1,
    }));
    
    console.log('Final result count:', result.length);
    console.log('Final result vehicle_ids:', result.map(r => r.vehicle_id));
    console.log('=== END filterVehiclesByGroup DEBUG ===');
    
    return {
      data: result,
      total,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize)
    };
  } catch (error: any) {
    console.error("[filterVehiclesByGroup] Error:", error.message);
    throw error;
  }
}


export async function filterVehiclesAll(
  vehicleType: string,
  vehicleFuel: string,
  ownership: string,
  rcAvailable: string,
  state: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: VehicleListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  let join = `
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN ownership_serial os ON os.ownership_id = CAST(v.ownership_serial AS UNSIGNED)
  `;

  // Base where: active auctions similar to "all" in group filter
  let where = '1=1';

  const filterConditions: string[] = [];
  const filterParams: any[] = [];

  if (vehicleType && vehicleType.trim()) {
    const typeIds = vehicleType.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
    if (typeIds.length > 0) {
      filterConditions.push(`v.vehicle_type_id IN (${typeIds.map(() => '?').join(',')})`);
      filterParams.push(...typeIds);
    }
  }

  if (vehicleFuel && vehicleFuel.trim()) {
    const fuelIds = vehicleFuel.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
    if (fuelIds.length > 0) {
      filterConditions.push(`v.fuel_type_id IN (${fuelIds.map(() => '?').join(',')})`);
      filterParams.push(...fuelIds);
    }
  }

  if (ownership && ownership.trim()) {
    const ownershipIds = ownership.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
    if (ownershipIds.length > 0) {
      filterConditions.push(`os.ownership_id IN (${ownershipIds.map(() => '?').join(',')})`);
      filterParams.push(...ownershipIds);
    }
  }

  if (rcAvailable && rcAvailable.trim()) {
    if (rcAvailable.toLowerCase() === 'true') {
      filterConditions.push('v.rc_availability = 1');
    } else if (rcAvailable.toLowerCase() === 'false') {
      filterConditions.push('v.rc_availability = 0');
    }
  }

  if (state && state.trim()) {
    const tokens = state.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const regionsAllowed = new Set(['north', 'west', 'south', 'east']);

    const stateIds = tokens
      .map((t) => parseInt(t, 10))
      .filter((n) => !Number.isNaN(n));

    const regionTokens = tokens
      .filter((t) => regionsAllowed.has(t.toLowerCase()))
      .map((t) => t.toLowerCase());

    const stateNames = tokens
      .filter((t) => Number.isNaN(parseInt(t, 10)) && !regionsAllowed.has(t.toLowerCase()))
      .map((t) => t.toLowerCase());

    const stateSubConditions: string[] = [];

    if (stateIds.length > 0) {
      stateSubConditions.push(`s.id IN (${stateIds.map(() => '?').join(',')})`);
      filterParams.push(...stateIds);
    }

    if (regionTokens.length > 0) {
      stateSubConditions.push(`LOWER(TRIM(s.region)) IN (${regionTokens.map(() => '?').join(',')})`);
      filterParams.push(...regionTokens);
    }

    if (stateNames.length > 0) {
      stateSubConditions.push(`LOWER(TRIM(s.state)) IN (${stateNames.map(() => '?').join(',')})`);
      filterParams.push(...stateNames);
    }

    if (stateSubConditions.length > 0) {
      filterConditions.push(`(${stateSubConditions.join(' OR ')})`);
    }
  }

  if (businessVertical === 'B' && bucketId) {
    filterConditions.push('v.bucket_id = ?', 'v.vehicle_category_id = 20');
    filterParams.push(bucketId);
  }

  const whereClause = [where, ...filterConditions, 'v.auction_end_dttm > NOW()', 'v.auction_status_id = 10'].join(' AND ');

  const countSql = `
    SELECT COUNT(*) as total
    FROM vehicles v
    ${join}
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    WHERE ${whereClause}
  `;

  const [countRows] = await db.query<RowDataPacket[]>(countSql, filterParams);
  const total = countRows[0]?.total || 0;

  const sql = `
    SELECT
      v.vehicle_id,
      MAX(v.auction_end_dttm) AS end_time,
      MAX(v.odometer_reading) AS odometer,
      MAX(ft.fuel_type) AS fuel,
      MAX(v.vehicle_image_id) AS vehicle_image_id,
      MAX(tt.transmission_name) AS transmissionType,
      MAX(v.rc_availability) AS rc_availability,
      MAX(v.repo_date) AS repo_date,
      MAX(os.ownership) AS ownership_label,
      MAX(mk.make_name) AS make,
      MAX(vmi.img_extension) AS img_extension,
      MAX(md.model_name) AS model,
      MAX(vv.variant_name) AS variant,
      MAX(v.manufacturing_year) AS manufacture_year,
      MAX(COALESCE(v.expected_price, v.base_price)) AS bid_amount,
      MAX(st.staff) AS manager_name,
      MAX(st.phone) AS manager_phone,
      MAX(st.email) AS manager_email,
      MAX(st.staff_id) AS manager_id,
      ? AS manager_image,
      MAX(v.regs_no) AS regs_no,
      MAX(v.added_on) AS added_on,
      ${buyerId ? 'CASE WHEN MAX(bb.buyer_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? "CASE WHEN MAX(bb.buyer_id) IS NULL THEN NULL WHEN MAX(bb.top_bid_at_insert) = 1 THEN 'Winning' ELSE 'Losing' END" : 'NULL'} AS bidding_status,
      ${buyerId ? 'CASE WHEN MAX(w.user_id) IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    ${join}
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    ${buyerId ? `LEFT JOIN (
      SELECT bb1.vehicle_id, bb1.buyer_id, bb1.top_bid_at_insert
      FROM buyer_bids bb1
      WHERE bb1.buyer_id = ?
      AND bb1.created_dttm = (
        SELECT MAX(bb2.created_dttm)
        FROM buyer_bids bb2
        WHERE bb2.vehicle_id = bb1.vehicle_id
        AND bb2.buyer_id = bb1.buyer_id
      )
    ) bb ON bb.vehicle_id = v.vehicle_id` : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE ${whereClause}
    GROUP BY v.vehicle_id
    ORDER BY v.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  const params = buyerId
    ? [MANAGER_IMG, buyerId, buyerId, ...filterParams, safePageSize, offset]
    : [MANAGER_IMG, ...filterParams, safePageSize, offset];

  const [rows] = await db.query<RowDataPacket[]>(sql, params);

  const result = rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
    odometer: r.odometer != null ? String(r.odometer) : null,
    fuel: r.fuel ?? null,
    owner_serial: r.ownership_label ?? null,
    state_code: typeof r.regs_no === 'string' && r.regs_no.length >= 2 ? r.regs_no.substring(0,2) : null,
    has_bidded: (r as any).has_bidded === 1,
    make: r.make ?? null,
    model: r.model ?? null,
    img_extension: r.img_extension ?? null,
    variant: r.variant ?? null,
    transmissionType: r.transmissionType ?? null,
    rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
    repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
    regs_no: r.regs_no ?? null,
    manufacture_year: r.manufacture_year ?? null,
    vehicleId: r.vehicle_id,
    imgIndex: r.vehicle_image_id ?? 1,
    bidding_status: r.bidding_status ?? null,
    bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
    manager_name: r.manager_name ?? null,
    manager_phone: r.manager_phone ?? null,
    manager_email: r.manager_email ?? null,
    manager_image: r.manager_image ?? MANAGER_IMG,
    manager_id: r.manager_id != null ? String(r.manager_id) : null,
    is_favorite: (r as any).is_favorite === 1,
  }));

  return {
    data: result,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}

export async function getOwnershipTypes() {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ownership_serial ORDER BY ownership_id ASC`
  );
  return rows;
}
export async function getSelectedVehicleImages(id: number) {
  if (!id || isNaN(id)) {
    throw new Error("Invalid vehicle id");
  }

  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY vehicle_image_id ASC`,
    [id]
  );
  return rows;
}


export async function getFuelTypes() {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM fuel_types ORDER BY id ASC`
  );
  return rows;
}

export async function getVehicleTypes() {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM vehicle_types ORDER BY id ASC`
  );
  return rows;
}

export async function getVehicleSubcategories() {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM vehicle_subcategory ORDER BY sub_category_id ASC`
  );
  return rows;
}

export async function updateVehicleBidCounters(vehicleId: number, topBidderId: number | null): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `UPDATE vehicles 
     SET bids_count = bids_count + 1,
         top_bidder_id = ?,
         bidders_count = CASE WHEN NOT EXISTS(
             SELECT 1 FROM buyer_bids WHERE vehicle_id = ? AND buyer_id = ?
         ) THEN bidders_count + 1 ELSE bidders_count END
     WHERE vehicle_id = ?`,
    [topBidderId, vehicleId, topBidderId, vehicleId]
  );
}

export async function extendAuctionEndTime(vehicleId: number): Promise<void> {
  const db: Pool = getDb();
  await db.query<ResultSetHeader>(
    `UPDATE vehicles
     SET auction_end_dttm = CASE
       WHEN TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) > 0
        AND TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) <= 300
       THEN DATE_ADD(auction_end_dttm, INTERVAL LEAST(GREATEST(TIMESTAMPDIFF(SECOND, auction_end_dttm, final_expiry_dttm), 0), 300) SECOND)
       ELSE auction_end_dttm
     END
     WHERE vehicle_id = ?`,
    [vehicleId]
  );
}


export interface BucketListItem {
  bucket_id: number;
  bucket_name: string;
  bucket_end_dttm: string | null;
  state: string | null;
  vehicles_count: number;
}

export async function getBucketsByGroup(
  type: 'state' | 'auction_status' | 'all',
  title: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number
): Promise<{ data: BucketListItem[], total: number, page: number, pageSize: number, totalPages: number }> {
  const db: Pool = getDb();
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (page - 1) * safePageSize;

  const safeTitle = String(title || '').trim();

  const join = `
    LEFT JOIN vehicles v ON v.bucket_id = b.bucket_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.case_option_id
  `;

  let where = 'v.auction_status_id = 10';
  const params: any[] = [];

  if (type === 'state') {
    where += ' AND LOWER(TRIM(s.region)) = LOWER(?)';
    params.push(safeTitle);
  } else if (type === 'auction_status') {
    where += ' AND LOWER(TRIM(co.case_name)) = LOWER(?)';
    params.push(safeTitle);
  }

  if (businessVertical === 'B') {
    where += ' AND v.vehicle_category_id = 20';
  } else if (businessVertical === 'I') {
    where += ' AND v.vehicle_category_id = 10';
  }

  if (bucketId != null && !Number.isNaN(bucketId)) {
    where += ' AND b.bucket_id = ?';
    params.push(bucketId);
  }

  const countSql = `
    SELECT COUNT(DISTINCT b.bucket_id) AS total
    FROM bucket b
    ${join}
    WHERE ${where}
  `;

  const [countRows] = await db.query<RowDataPacket[]>(countSql, params);
  const total = countRows[0]?.total || 0;

  const sql = `
    SELECT
      b.bucket_id AS bucket_id,
      b.bucket_nm AS bucket_name,
      b.auction_end_dttm AS bucket_end_dttm,
      MAX(s.state) AS state,
      COUNT(DISTINCT v.vehicle_id) AS vehicles_count
    FROM bucket b
    ${join}
    WHERE ${where}
    GROUP BY b.bucket_id
    ORDER BY b.auction_end_dttm ASC
    LIMIT ? OFFSET ?
  `;

  const listParams = [...params, safePageSize, offset];
  const [rows] = await db.query<RowDataPacket[]>(sql, listParams);
  const data: BucketListItem[] = rows.map(r => ({
    bucket_id: Number(r.bucket_id),
    bucket_name: r.bucket_name,
    bucket_end_dttm: r.bucket_end_dttm ? new Date(r.bucket_end_dttm).toISOString() : null,
    state: r.state ?? null,
    vehicles_count: Number(r.vehicles_count) || 0,
  }));

  return {
    data,
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}
