import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { Vehicle } from "./vehicle.model";

const TABLE = "vehicle";

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
  type: "state" | "auction_status";
  title: string;
  total_vehicles: string;
  image: string;
}

export async function getGroups(): Promise<VehicleGroupItem[]> {
  const db: Pool = getDb();

  const DEFAULT_IMG =
    "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800";

  // States grouped by region
  const [stateRows] = await db.query<RowDataPacket[]>(
    `SELECT s.region AS region, COUNT(*) AS total
     FROM vehicle v
     INNER JOIN states s ON s.id = v.vehicle_state_id
     WHERE s.region IS NOT NULL
     GROUP BY s.region
     ORDER BY s.region`
  );
  
  const stateItems: VehicleGroupItem[] = stateRows.map((r, index) => ({
    id: String(index + 1),
    type: "state",
    title: String(r.region),
    total_vehicles: String(r.total),
    image: DEFAULT_IMG,
  }));

  // Auction status via case_options
  const [statusRows] = await db.query<RowDataPacket[]>(
    `SELECT co.id AS id, co.case_name AS name, COUNT(*) AS total
     FROM vehicle v
     INNER JOIN case_options co ON co.id = v.auction_status_id
     GROUP BY co.id, co.case_name
     ORDER BY co.id`
  );

  const statusItems: VehicleGroupItem[] = statusRows.map((r) => ({
    id: String(r.id),
    type: "auction_status", // Fixed typo: was "aunction_status"
    title: String(r.name),
    total_vehicles: String(r.total),
    image: DEFAULT_IMG,
  }));

  return [...stateItems, ...statusItems];
}

export interface VehicleListItem {
  vehicle_id: string;
  end_time: string | null;
  odometer: string | null;
  fuel: string | null;
  owner_serial: string | null;
  state_rto: string | null;
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

export async function getVehiclesByGroup(
  type: "state" | "auction_status",
  id: number,
  limit = 50,
  offset = 0
): Promise<VehicleListItem[]> {
  const db: Pool = getDb();
  const DEFAULT_IMG =
    "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800";
  const MANAGER_IMG =
    "https://images.unsplash.com/photo-1519211975560-4ca611f5a72a?w=800";

  // sanitize inputs
  const safeId = Number.isInteger(Number(id)) ? Number(id) : 0;
  const safeLimit = Math.max(0, parseInt(String(limit), 10) || 50);
  const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

  // build where clause (we won't push params yet; we'll construct `params` in SQL-order)
  let where = "";
  if (type === "auction_status") {
    where = "v.auction_status_id = ?";
  } else if (type === "state") {
    where = "v.vehicle_state_id = ?";
  } else {
    return [];
  }

  const sql = `
    SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      s.rto AS state_rto,
      mk.make_name AS make,
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
    FROM vehicle v
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN states s ON s.id = v.vehicle_state_id
    LEFT JOIN vehicle_model md ON md.vehicle_model_id = v.vehicle_model_id
    LEFT JOIN vehicle_make mk ON mk.id = v.vehicle_make_id
    LEFT JOIN vehicle_variant vv ON vv.vehicle_variant_id = v.vehicle_variant_id
    LEFT JOIN case_options co ON co.id = v.auction_status_id
    LEFT JOIN staff st ON st.staff_id = v.vehicle_manager_id
    WHERE ${where}
    ORDER BY v.added_on DESC
    LIMIT ? OFFSET ?
  `;

  // IMPORTANT: params order must follow the order of ? in SQL above:
  // 1) manager_image, 2) main_image, 3) where id, 4) limit, 5) offset
  const params = [MANAGER_IMG, DEFAULT_IMG, safeId, safeLimit, safeOffset];

  console.log("SQL params:", params, "limit:", safeLimit, "offset:", safeOffset);
  const [rows] = await db.query<RowDataPacket[]>(sql, params);

  
  const result = rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
    odometer: r.odometer != null ? String(r.odometer) : null,
    fuel: r.fuel ?? null,
    owner_serial: r.ownership_serial ?? null,
    state_rto: r.state_rto ?? null,
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
  }))
  console.log("Result:", result[0]);
  return result;
}

export async function getVehicleDetails(vehicleId: number): Promise<VehicleListItem | null> {
  const db: Pool = getDb();
  const DEFAULT_IMG =
    "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800";

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
      v.vehicle_id,
      v.auction_end_dttm AS end_time,
      v.odometer_reading AS odometer,
      ft.fuel_type AS fuel,
      v.ownership_serial,
      s.rto AS state_rto,
      mk.make_name AS make,
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
    FROM vehicle v
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
