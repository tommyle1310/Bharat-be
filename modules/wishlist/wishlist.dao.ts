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

export async function getWishlist(buyerId: number, businessVertical: 'A'|'B'|'I' = 'A', limit = 50, offset = 0): Promise<WishlistItem[]> {
  const db: Pool = getDb();
  const MANAGER_IMG = DEFAULT_IMAGES.MANAGER;

  const categoryFilter = businessVertical === 'I' ? ' AND v.vehicle_category_id = 10'
    : businessVertical === 'B' ? ' AND v.vehicle_category_id = 20'
    : '';

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
        (CASE WHEN bmk.make_id IS NULL THEN 0 ELSE 1 END)
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

  const params = [MANAGER_IMG, buyerId, buyerId, buyerId, buyerId, buyerId, buyerId, limit, offset];
  const [rows] = await db.query<RowDataPacket[]>(sql, params);

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
}


