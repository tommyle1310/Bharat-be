import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { Vehicle } from "./vehicle.model";
import { getDataFileUrl, DEFAULT_IMAGES } from "../../utils/static-files";

const TABLE = "vehicles";

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
       ON v.auction_status_id = co.id
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
}

export async function searchVehicles(
  keyword: string,
  limit = 50,
  offset = 0,
  buyerId?: number
): Promise<VehicleItem[]> {
  const db: Pool = getDb();

  const likeKeyword = `%${keyword}%`;

  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT 
      v.vehicle_id,
      v.regs_no,
      v.manufacturing_year,
      v.base_price,
      v.max_price,
      v.vehicle_location,
      vm.make_name AS vehicle_make,
      vmo.model_name AS vehicle_model,
      vv.variant_name AS vehicle_variant,
      ft.fuel_type AS fuel_type,
      tt.transmission_name AS transmissionType,
      v.rc_availability,
      v.repo_date,
      s.staff AS staff_name,
      s.phone AS staff_phone,
      ${buyerId ? 'CASE WHEN bb.buyer_id IS NULL THEN 0 ELSE 1 END' : '0'} AS has_bidded,
      ${buyerId ? 'CASE WHEN w.user_id IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite
    FROM vehicles v
    LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id
    LEFT JOIN vehicle_model vmo ON v.vehicle_model_id = vmo.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON v.vehicle_variant_id = vv.vehicle_variant_id
    LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
    LEFT JOIN transmission_type tt ON tt.id = v.transmission_type_id
    LEFT JOIN staff s ON v.vehicle_manager_id = s.staff_id
    ${buyerId ? 'LEFT JOIN buyer_bids bb ON bb.vehicle_id = v.vehicle_id AND bb.buyer_id = ?' : ''}
    ${buyerId ? 'LEFT JOIN watchlist w ON w.vehicle_id = v.vehicle_id AND w.user_id = ?' : ''}
    WHERE 
      v.manufacturing_year LIKE ?
      OR vm.make_name LIKE ?
      OR vmo.model_name LIKE ?
      OR vv.variant_name LIKE ?
      OR ft.fuel_type LIKE ?
      OR s.staff LIKE ?
      OR s.phone LIKE ?
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
    `,
    buyerId ? [
      buyerId,
      buyerId,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      limit,
      offset,
    ] : [
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      limit,
      offset,
    ]
  );

  return rows.map((r) => ({
    ...r,
    has_bidded: (r as any).has_bidded === 1,
    rc_availability: r.rc_availability == null ? null : Boolean(r.rc_availability),
    repo_date: r.repo_date ? new Date(r.repo_date).toISOString() : null,
    is_favorite: (r as any).is_favorite === 1,
  })) as VehicleItem[];
}

export async function getVehiclesByGroup(
  type: "state" | "auction_status" | "all",
  title: string,
  limit = 50,
  offset = 0,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A'
): Promise<VehicleListItem[]> {
  const db: Pool = getDb();

  // Use static file serving for images
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  // sanitize inputs
  const safeTitle = String(title || "").trim();
  const safeLimit = Math.max(1, parseInt(String(limit), 10) || 50);
  const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

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
      LEFT JOIN case_options co ON co.id = v.auction_status_id
      LEFT JOIN states s ON s.id = v.vehicle_state_id
    `;
    where = "LOWER(TRIM(co.case_name)) = LOWER(?)" + categoryFilter;
  } else if (type === "state") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.auction_status_id
    `;
    where = "LOWER(TRIM(s.region)) = LOWER(?)" + categoryFilter;
  } else if (type === "all") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.auction_status_id
    `;
    where = "1=1" + categoryFilter;
  }

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
    WHERE ${where}
    GROUP BY v.vehicle_id
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  let params: any[];

  if (type === "all") {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, safeLimit, safeOffset] : [MANAGER_IMG, safeLimit, safeOffset];
  } else {
    // Order must match: manager_image, bb.buyer_id, w.user_id, title, limit, offset
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, safeTitle, safeLimit, safeOffset] : [MANAGER_IMG, safeTitle, safeLimit, safeOffset];
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
  
  return result;
}

export async function searchVehiclesByGroup(
  keyword: string,
  type: "state" | "auction_status" | "all",
  title: string,
  limit = 50,
  offset = 0,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A'
): Promise<VehicleListItem[]> {
  const db: Pool = getDb();

  // Default image URLs
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  // Sanitize inputs
  const safeKeyword = `%${String(keyword || "").trim()}%`;
  const safeTitle = String(title || "").trim();
  const safeLimit = Math.max(1, parseInt(String(limit), 10) || 50);
  const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

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
    LEFT JOIN case_options co ON co.id = v.auction_status_id
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
    WHERE ${where} AND ${searchCondition}
    GROUP BY v.vehicle_id
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  // Prepare query parameters
  let params: any[];
  if (type === "all") {
    // For "all" type, no title parameter is needed since where = "1=1"
    params = [
      MANAGER_IMG,
      ...(buyerId ? [buyerId, buyerId] : []),
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      safeLimit,
      safeOffset,
    ];
  } else {
    // For "state" and "auction_status" types, title parameter is needed
    params = [
      MANAGER_IMG,
      ...(buyerId ? [buyerId, buyerId] : []),
      safeTitle,
      ...(hasKeyword ? [safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword, safeKeyword] : []),
      safeLimit,
      safeOffset,
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
    
    return result;
  } catch (error: any) {
    console.error("[searchVehiclesByGroup] Error:", error.message);
    throw error;
  }
}

export async function getVehicleDetails(
  vehicleId: number,
  buyerId?: number
): Promise<VehicleListItem | null> {
  const db: Pool = getDb();
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

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
    WHERE v.vehicle_id = ?
    GROUP BY v.vehicle_id
    LIMIT 1`;

  const params = buyerId ? [MANAGER_IMG, buyerId, buyerId, vehicleId] : [MANAGER_IMG, vehicleId];
  
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
  limit = 50,
  offset = 0,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A'
): Promise<VehicleListItem[]> {
  const db: Pool = getDb();

  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE;
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  const safeTitle = String(title || "").trim();
  const safeLimit = Math.max(1, parseInt(String(limit), 10) || 50);
  const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

  let where = "";
  let join = `
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.auction_status_id
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
    where = `LOWER(TRIM(co.case_name)) = LOWER(?) AND v.auction_end_dttm > NOW()` + categoryFilter;
  } else if (type === "state") {
    where = `LOWER(TRIM(s.region)) = LOWER(?) AND v.auction_end_dttm > NOW()` + categoryFilter;
  } else if (type === "all") {
    where = "v.auction_end_dttm > NOW()" + categoryFilter;
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
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  let params: any[];
  if (type === "all") {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, ...filterParams, safeLimit, safeOffset] : [MANAGER_IMG, ...filterParams, safeLimit, safeOffset];
  } else {
    params = buyerId ? [MANAGER_IMG, buyerId, buyerId, safeTitle, ...filterParams, safeLimit, safeOffset] : [MANAGER_IMG, safeTitle, ...filterParams, safeLimit, safeOffset];
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
    
    return result;
  } catch (error: any) {
    console.error("[filterVehiclesByGroup] Error:", error.message);
    throw error;
  }
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

