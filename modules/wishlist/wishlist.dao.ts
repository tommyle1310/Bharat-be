import { Pool, RowDataPacket } from "mysql2/promise";
import { getDb } from "../../config/database";
import { DEFAULT_IMAGES } from "../../utils/static-files";

export interface WishlistItem {
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
}

export async function getWishlist(
  buyerId: number,
  businessVertical: 'A'|'B'|'I' = 'A',
  limit = 50,
  offset = 0,
  filters?: { rcAvailable?: string; vehicleFuel?: string }
): Promise<WishlistItem[]> {
  const db: Pool = getDb();
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  const categoryFilter = businessVertical === 'I' ? ' AND v.vehicle_category_id = 10'
    : businessVertical === 'B' ? ' AND v.vehicle_category_id = 20'
    : '';

  const rcFilter = String(filters?.rcAvailable || '');
  const fuelFilter = String(filters?.vehicleFuel || '');

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
        (CASE WHEN brs.state_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN bmk.make_id IS NULL THEN 0 ELSE 1 END) +
        (
          CASE
            WHEN ? = '' THEN 0
            WHEN (LOWER(?) IN ('1','true') AND COALESCE(v.rc_availability,0) = 1) THEN 1
            WHEN (LOWER(?) IN ('0','false') AND COALESCE(v.rc_availability,0) = 0) THEN 1
            ELSE 0
          END
        ) +
        (
          CASE
            WHEN ? = '' THEN 0
            WHEN FIND_IN_SET(v.fuel_type_id, ?) THEN 1
            ELSE 0
          END
        )
      ) AS total_flags
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
    LEFT JOIN buyer_preference_regstate brs
      ON brs.state_id = v.vehicle_state_id AND brs.buyer_id = ?
    LEFT JOIN buyer_preference_make bmk
      ON bmk.make_id = v.vehicle_make_id AND bmk.buyer_id = ?
    WHERE 1=1 ${categoryFilter}
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
    rcFilter,
    rcFilter,
    rcFilter,
    fuelFilter,
    fuelFilter,
    limit,
    offset,
  ];
  try {
    console.log('=== getWishlist DEBUG ===');
    console.log('buyerId:', buyerId);
    console.log('businessVertical:', businessVertical);
    console.log('categoryFilter:', categoryFilter);
    console.log('filters.rcAvailable:', rcFilter);
    console.log('filters.vehicleFuel:', fuelFilter);
    console.log('SQL:', sql);
    console.log('Params:', params);

    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    console.log('Raw rows count:', rows.length);
    if (rows.length) {
      console.log('Sample vehicle_ids:', rows.slice(0, 10).map(r => r.vehicle_id));
      // Also log total_flags if present in driver payload
      try { console.log('Sample total_flags:', rows.slice(0, 5).map(r => (r as any).total_flags)); } catch {}
    }

    return rows.map((r) => ({
      vehicle_id: String(r.vehicle_id),
      end_time: r.end_time ? new Date(r.end_time).toISOString() : null,
      odometer: r.odometer != null ? String(r.odometer) : null,
      fuel: r.fuel ?? null,
      owner_serial: r.ownership_serial ?? null,
      state_code: typeof r.regs_no === 'string' && r.regs_no.length >= 2 ? r.regs_no.substring(0,2) : null,
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
      bidding_status: null,
      bid_amount: r.bid_amount != null ? String(r.bid_amount) : null,
      manager_name: r.manager_name ?? null,
      manager_phone: r.manager_phone ?? null,
      manager_email: r.manager_email ?? null,
      manager_image: r.manager_image ?? MANAGER_IMG,
      manager_id: r.manager_id != null ? String(r.manager_id) : null,
    }));
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
  regstate: string; // region filter: 'North'|'West'|'South'|'East'
  makeIds?: string; // csv
  regStateIds?: string; // csv
  stateIds?: string; // csv
  subcategoryIds?: string; // csv
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
  const categoryId = mapBusinessVerticalToCategoryId(input.businessVertical);

  const vehicleTypeIds = parseCsvIds(input.vehicleType);
  const makeIds = parseCsvIds(input.makeIds);
  const regStateIds = parseCsvIds(input.regStateIds);
  const sellerIds = parseCsvIds(input.sellerId);
  const stateIds = parseCsvIds(input.stateIds);
  const subcategoryIds = parseCsvIds(input.subcategoryIds);

  // Handle regstate region filter - get state IDs from states table
  let regionStateIds: number[] = [];
  if (input.regstate && input.regstate.trim()) {
    const region = input.regstate.trim();
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM states WHERE region = ?',
      [region]
    );
    regionStateIds = rows.map(r => r.id);
  }

  const now = new Date();

  const conn = db; // using pool query with transaction
  const connection = await conn.getConnection();
  try {
    await connection.beginTransaction();

    // Clear existing for this buyer/category
    const tables = [
      'buyer_preference_vehicletype',
      'buyer_preference_make',
      'buyer_preference_regstate',
      'buyer_preference_seller',
      'buyer_preference_state',
      'buyer_preference_subcategory',
    ];
    for (const t of tables) {
      await connection.query(`DELETE FROM ${t} WHERE buyer_id = ? AND category_id = ?`, [input.buyerId, categoryId]);
    }

    // Insert helpers
    async function insertMany(table: string, column: string, ids: number[]) {
      if (!ids.length) return;
      const valuesPlaceholders = ids.map(() => '(?, ?, ?, ?, ?)').join(',');
      const params: any[] = [];
      for (const id of ids) {
        params.push(0, input.buyerId, id, categoryId, 0);
      }
      // columns differ for regstate/state/make/seller/subcategory/vehicletype but order is (id,buyer_id,<col>,category_id,is_surrogate)
      const updatedDttmSql = ', updated_dttm = VALUES(updated_dttm), is_surrogate = VALUES(is_surrogate)';
      const sql = `INSERT INTO ${table} (id, buyer_id, ${column}, category_id, is_surrogate, updated_dttm)
        VALUES ${ids.map(() => '(0, ?, ?, ?, 0, NOW())').join(',')}
        ON DUPLICATE KEY UPDATE updated_dttm = NOW(), is_surrogate = 0`;
      await connection.query(sql, ids.flatMap(id => [input.buyerId, id, categoryId]));
    }

    await insertMany('buyer_preference_vehicletype', 'vehicletype_id', vehicleTypeIds);
    await insertMany('buyer_preference_make', 'make_id', makeIds);
    await insertMany('buyer_preference_regstate', 'state_id', [...regStateIds, ...regionStateIds]);
    await insertMany('buyer_preference_seller', 'seller_id', sellerIds);
    await insertMany('buyer_preference_state', 'state_id', [...stateIds, ...regionStateIds]);
    await insertMany('buyer_preference_subcategory', 'subcategory_id', subcategoryIds);

    await connection.commit();
    return {
      vehicletype: vehicleTypeIds.length,
      make: makeIds.length,
      regstate: regStateIds.length + regionStateIds.length,
      seller: sellerIds.length,
      state: stateIds.length + regionStateIds.length,
      subcategory: subcategoryIds.length,
    };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

