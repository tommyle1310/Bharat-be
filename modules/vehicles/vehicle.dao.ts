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

export interface VehicleGroupItem {
  id: string;
  type: "state" | "auction_status" | "all";
  title: string;
  total_vehicles: string;
  image: string;
}

export async function getGroups(): Promise<VehicleGroupItem[]> {
  const db: Pool = getDb();

  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL

  const REGIONS = ["North", "South", "East", "West"];
  const now = new Date();

  // Count per region, only vehicles with auction_end_dttm > now
  const [regionRows] = await db.query<RowDataPacket[]>(
    `SELECT s.region AS region, COUNT(v.vehicle_id) AS total
     FROM states s
     LEFT JOIN vehicles v 
       ON v.vehicle_state_id = s.id 
      AND v.auction_end_dttm > NOW()
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
    image: DEFAULT_IMG,
  }));

  // Auction status via case_options, only auction_end_dttm > now
  const [statusRows] = await db.query<RowDataPacket[]>(
    `SELECT co.id AS id, co.case_name AS name, COUNT(v.vehicle_id) AS total
     FROM case_options co
     LEFT JOIN vehicles v 
       ON v.auction_status_id = co.id 
      AND v.auction_end_dttm > NOW()
     GROUP BY co.id, co.case_name
     ORDER BY co.id`
  );

  const statusItems: VehicleGroupItem[] = statusRows.map((r) => ({
    id: String(r.id),
    type: "auction_status",
    title: String(r.name),
    total_vehicles: String(r.total),
    image: DEFAULT_IMG,
  }));

  // Tổng số xe chưa hết hạn
  const [allRows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_all FROM vehicles WHERE auction_end_dttm > NOW()`
  );

  const total_all = allRows?.[0]?.total_all ?? 0;

  const allItem: VehicleGroupItem = {
    id: "0",
    type: "all",
    title: "All",
    total_vehicles: String(total_all),
    image: DEFAULT_IMG,
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
  vehicle_variant: string | null;
  fuel_type: string | null;
  staff_name: string | null;
  staff_phone: string | null;
}

export interface VehicleListItem {
  vehicle_id: string;
  end_time: string | null;
  odometer: string | null;
  fuel: string | null;
  owner_serial: string | null;
  state_rto: string | null;
  img_extension: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  is_favorite: boolean;
  manufacture_year: string | null;
  main_image: string | null;
  status: string | null;
  bid_amount: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  manager_image: string | null;
  manager_id: string | null;
}

export async function searchVehicles(
  keyword: string,
  limit = 50,
  offset = 0
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
      s.staff AS staff_name,
      s.phone AS staff_phone
    FROM vehicles v
    LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id
    LEFT JOIN vehicle_model vmo ON v.vehicle_model_id = vmo.vehicle_model_id
    LEFT JOIN vehicle_variant vv ON v.vehicle_variant_id = vv.vehicle_variant_id
    LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
    LEFT JOIN staff s ON v.vehicle_manager_id = s.staff_id
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
    [
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

  return rows as VehicleItem[];
}

export async function getVehiclesByGroup(
  type: "state" | "auction_status" | "all",
  title: string,
  limit = 50,
  offset = 0
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

  if (type === "auction_status") {
    join = `
      LEFT JOIN case_options co ON co.id = v.auction_status_id
      LEFT JOIN states s ON s.id = v.vehicle_state_id
    `;
    where =
      "LOWER(TRIM(co.case_name)) = LOWER(?) AND v.auction_end_dttm > NOW()";
  } else if (type === "state") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.auction_status_id
    `;
    where = "LOWER(TRIM(s.region)) = LOWER(?) AND v.auction_end_dttm > NOW()";
  } else if (type === "all") {
    join = `
      LEFT JOIN states s ON s.id = v.vehicle_state_id
      LEFT JOIN case_options co ON co.id = v.auction_status_id
    `;
    where = "v.auction_end_dttm > NOW()";
  }

  const sql = `
    SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      mk.make_name AS make,
      vmi.img_extension AS img_extension,
      md.model_name AS model,
      vv.variant_name AS variant,
      v.manufacturing_year AS manufacture_year,
      co.case_name AS status,
      COALESCE(v.expected_price, v.base_price) AS bid_amount,
      st.staff AS manager_name,
      st.phone AS manager_phone,
      st.email AS manager_email,
      st.staff_id AS manager_id,
      ? AS manager_image,
      ? AS main_image
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    ${join}
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    WHERE ${where} AND v.auction_end_dttm > NOW()
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  let params: any[];

  if (type === "all") {
    params = [MANAGER_IMG, DEFAULT_IMG, safeLimit, safeOffset];
  } else {
    params = [MANAGER_IMG, DEFAULT_IMG, safeTitle, safeLimit, safeOffset];
  }

  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  console.log('check rows', rows)
  return rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
    odometer: r.odometer != null ? String(r.odometer) : null,
    fuel: r.fuel ?? null,
    owner_serial: r.ownership_serial ?? null,
    state_rto: r.state_rto ?? null,
    make: r.make ?? null,
    model: r.model ?? null,
    variant: r.variant ?? null,
    img_extension: r.img_extension ?? null,
    is_favorite: false,
    manufacture_year: r.manufacture_year ?? null,
    main_image: r.main_image ?? DEFAULT_IMG,
    vehicleId: r.vehicle_id,
    imgIndex: r.vehicle_image_id ?? 1,
    status: r.status ?? null,
    bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
    manager_name: r.manager_name ?? null,
    manager_phone: r.manager_phone ?? null,
    manager_email: r.manager_email ?? null,
    manager_image: r.manager_image ?? DEFAULT_IMG,
    manager_id: r.manager_id != null ? String(r.manager_id) : null,
  }));
}

export async function searchVehiclesByGroup(
  keyword: string,
  type: "state" | "auction_status" | "all",
  title: string,
  limit = 50,
  offset = 0
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
    LEFT JOIN vehicle_images vmi ON vmi.vehicle_image_id = v.vehicle_image_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.auction_status_id
  `;

  if (type === "auction_status") {
    where = `LOWER(TRIM(co.case_name)) = LOWER(?) AND v.auction_end_dttm > NOW()`;
  } else if (type === "state") {
    where = `LOWER(TRIM(s.region)) = LOWER(?) AND v.auction_end_dttm > NOW()`;
  } else if (type === "all") {
    where = "v.auction_end_dttm > NOW()";
  }

  // Combine keyword search with type/title filter
  const searchCondition = `
    (
      v.manufacturing_year LIKE ?
      OR mk.make_name LIKE ?
      OR md.model_name LIKE ?
      OR vv.variant_name LIKE ?
      OR ft.fuel_type LIKE ?
      OR st.staff LIKE ?
      OR st.phone LIKE ?
    )
  `;

  const sql = `
    SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      mk.make_name AS make,
      vmi.img_extension AS img_extension,
      md.model_name AS model,
      vv.variant_name AS variant,
      v.manufacturing_year AS manufacture_year,
      co.case_name AS status,
      COALESCE(v.expected_price, v.base_price) AS bid_amount,
      st.staff AS manager_name,
      st.phone AS manager_phone,
      st.email AS manager_email,
      st.staff_id AS manager_id,
      ? AS manager_image,
      ? AS main_image,
      v.vehicle_state_id AS state_rto,
      v.vehicle_image_id
    FROM vehicles v
    ${join}
    WHERE ${where} AND ${searchCondition}
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  // Prepare query parameters
  let params: any[];
  if (type === "all") {
    params = [
      MANAGER_IMG,
      DEFAULT_IMG,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeLimit,
      safeOffset,
    ];
  } else {
    params = [
      MANAGER_IMG,
      DEFAULT_IMG,
      safeTitle,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeKeyword,
      safeLimit,
      safeOffset,
    ];
  }

  try {
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows.map((r) => ({
      vehicle_id: String(r.vehicle_id),
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
      odometer: r.odometer != null ? String(r.odometer) : null,
      fuel: r.fuel ?? null,
      owner_serial: r.ownership_serial ?? null,
      state_rto: r.state_rto ?? null,
      make: r.make ?? null,
      model: r.model ?? null,
      img_extension: r.img_extension ?? null,
      variant: r.variant ?? null,
      manufacture_year: r.manufacture_year ?? null,
      main_image: r.main_image ?? DEFAULT_IMG,
      vehicleId: r.vehicle_id,
      imgIndex: r.vehicle_image_id ?? 1,
      status: r.status ?? null,
      bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
      manager_name: r.manager_name ?? null,
      manager_phone: r.manager_phone ?? null,
      manager_email: r.manager_email ?? null,
      manager_image: r.manager_image ?? DEFAULT_IMG,
      manager_id: r.manager_id != null ? String(r.manager_id) : null,
      is_favorite: false,
    }));
  } catch (error: any) {
    console.error("[searchVehiclesByGroup] Error:", error.message);
    throw error;
  }
}

export async function getVehicleDetails(
  vehicleId: number
): Promise<VehicleListItem | null> {
  const db: Pool = getDb();
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      mk.make_name AS make,
      vmi.img_extension AS img_extension,
      md.model_name AS model,
      vv.variant_name AS variant,
      v.manufacturing_year AS manufacture_year,
      co.case_name AS status,
      COALESCE(v.expected_price, v.base_price) AS bid_amount,
      st.staff AS manager_name,
      st.phone AS manager_phone,
      st.email AS manager_email,
      st.staff_id AS manager_id,
      (
        SELECT CONCAT('https://images.unsplash.com/photo-1519211975560-4ca611f5a72a?w=800')
      ) AS manager_image,
      (
        SELECT CONCAT('https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800')
      ) AS main_image
    FROM vehicles v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
      LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
      LEFT JOIN case_options co ON co.id = v.auction_status_id
      LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
      WHERE v.vehicle_id = ?
      LIMIT 1`,
    [vehicleId]
  );

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
    state_rto: r.state_rto ?? null,
    img_extension: r.img_extension ?? null,
    make: r.make ?? null,
    model: r.model ?? null,
    variant: r.variant ?? null,
    is_favorite: false,
    manufacture_year: r.manufacture_year ?? null,
    main_image: r.main_image ?? DEFAULT_IMG,
    status: r.status ?? null,
    bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
    manager_name: r.manager_name ?? null,
    manager_phone: r.manager_phone ?? null,
    manager_email: r.manager_email ?? null,
    manager_image: r.manager_image ?? DEFAULT_IMG,
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
  limit = 50,
  offset = 0
): Promise<VehicleListItem[]> {
  const db: Pool = getDb();

  // Default image URLs
  const DEFAULT_IMG = DEFAULT_IMAGES.VEHICLE; // Fallback to external URL
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER; // Fallback to external URL

  // Sanitize inputs
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
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN case_options co ON co.id = v.auction_status_id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN ownership_serial os ON os.id = v.vehicle_ownership_type_id
  `;

  if (type === "auction_status") {
    where = `LOWER(TRIM(co.case_name)) = LOWER(?) AND v.auction_end_dttm > NOW()`;
  } else if (type === "state") {
    where = `LOWER(TRIM(s.region)) = LOWER(?) AND v.auction_end_dttm > NOW()`;
  } else if (type === "all") {
    where = "v.auction_end_dttm > NOW()";
  }

  // Build filter conditions
  const filterConditions = [];
  const filterParams = [];

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

  // Ownership filter
  if (ownership && ownership.trim()) {
    const ownershipIds = ownership
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
    if (ownershipIds.length > 0) {
      filterConditions.push(
        `v.vehicle_ownership_type_id IN (${ownershipIds
          .map(() => "?")
          .join(",")})`
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

  // Combine all conditions
  const allConditions = [where];
  if (filterConditions.length > 0) {
    allConditions.push(...filterConditions);
  }
  const whereClause = allConditions.join(" AND ");

  const sql = `
    SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      mk.make_name AS make,
      vmi.img_extension AS img_extension,
      md.model_name AS model,
      vv.variant_name AS variant,
      v.manufacturing_year AS manufacture_year,
      co.case_name AS status,
      COALESCE(v.expected_price, v.base_price) AS bid_amount,
      st.staff AS manager_name,
      st.phone AS manager_phone,
      st.email AS manager_email,
      st.staff_id AS manager_id,
      ? AS manager_image,
      ? AS main_image,
      v.vehicle_state_id AS state_rto,
      v.vehicle_image_id
    FROM vehicles v
    ${join}
    WHERE ${whereClause}
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  // Prepare query parameters
  let params: any[];
  if (type === "all") {
    params = [MANAGER_IMG, DEFAULT_IMG, ...filterParams, safeLimit, safeOffset];
  } else {
    params = [
      MANAGER_IMG,
      DEFAULT_IMG,
      safeTitle,
      ...filterParams,
      safeLimit,
      safeOffset,
    ];
  }

  try {
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows.map((r) => ({
      vehicle_id: String(r.vehicle_id),
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
      odometer: r.odometer != null ? String(r.odometer) : null,
      fuel: r.fuel ?? null,
      owner_serial: r.ownership_serial ?? null,
      state_rto: r.state_rto ?? null,
      make: r.make ?? null,
      model: r.model ?? null,
      img_extension: r.img_extension ?? null,
      variant: r.variant ?? null,
      manufacture_year: r.manufacture_year ?? null,
      main_image: r.main_image ?? DEFAULT_IMG,
      vehicleId: r.vehicle_id,
      imgIndex: r.vehicle_image_id ?? 1,
      status: r.status ?? null,
      bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
      manager_name: r.manager_name ?? null,
      manager_phone: r.manager_phone ?? null,
      manager_email: r.manager_email ?? null,
      manager_image: r.manager_image ?? DEFAULT_IMG,
      manager_id: r.manager_id != null ? String(r.manager_id) : null,
      is_favorite: false,
    }));
  } catch (error: any) {
    console.error("[filterVehiclesByGroup] Error:", error.message);
    throw error;
  }
}

export async function getOwnershipTypes() {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ownership_serial ORDER BY id ASC`
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
