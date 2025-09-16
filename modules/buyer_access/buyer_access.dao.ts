import { Pool, RowDataPacket } from "mysql2/promise";
import { getDb } from "../../config/database";

export interface BuyerAccessCheck {
  hasAccess: boolean;
  missingAccess: string[];
  vehicleInfo: {
    vehicle_id: number;
    vehicle_type_id: number;
    vehicle_category_id: number;
    vehicle_subcategory_id: number;
    seller_id: number;
    vehicle_state_id: number;
  };
}

export async function checkBuyerAccess(
  buyerId: number,
  vehicleId: number
): Promise<BuyerAccessCheck> {
  const db: Pool = getDb();

  console.debug(`[checkBuyerAccess] Start - buyerId=${buyerId}, vehicleId=${vehicleId}`);

  // First, get vehicle information
  console.debug("[checkBuyerAccess] Fetching vehicle info...");
  const [vehicleRows] = await db.query<RowDataPacket[]>(
    `
    SELECT 
      vehicle_id,
      vehicle_type_id,
      vehicle_category_id,
      vehicle_subcategory_id,
      seller_id,
      vehicle_state_id
    FROM vehicles 
    WHERE vehicle_id = ?
    `,
    [vehicleId]
  );

  console.debug("[checkBuyerAccess] Vehicle query result:", vehicleRows);

  if (vehicleRows.length === 0) {
    console.error(`[checkBuyerAccess] Vehicle not found - vehicleId=${vehicleId}`);
    throw new Error("Vehicle not found");
  }

  const vehicle = vehicleRows[0];
  if (!vehicle) {
    console.error(`[checkBuyerAccess] Vehicle row undefined - vehicleId=${vehicleId}`);
    throw new Error("Vehicle not found");
  }

  // Fetch human-friendly labels for error messages
  let sellerName: string | null = null;
  let stateName: string | null = null;
  let subcategoryName: string | null = null;
  let vehicleTypeName: string | null = null;

  try {
    // states
    const [sRows] = await db.query<RowDataPacket[]>(
      `SELECT state FROM states WHERE id = ?`,
      [vehicle.vehicle_state_id]
    );
    stateName = sRows[0]?.state ?? null;
  } catch {}

  try {
    // vehicle_subcategory
    const [scRows] = await db.query<RowDataPacket[]>(
      `SELECT sub_category FROM vehicle_subcategory WHERE sub_category_id = ?`,
      [vehicle.vehicle_subcategory_id]
    );
    subcategoryName = scRows[0]?.sub_category ?? null;
  } catch {}

  try {
    // vehicle_types
    const [vtRows] = await db.query<RowDataPacket[]>(
      `SELECT vehicle_type FROM vehicle_types WHERE id = ?`,
      [vehicle.vehicle_type_id]
    );
    vehicleTypeName = vtRows[0]?.vehicle_type ?? null;
  } catch {}

  try {
    // sellers table (prefer plural), fallback to singular table name if needed
    let selRows: RowDataPacket[];
    [selRows] = await db.query<RowDataPacket[]>(
      `SELECT name FROM sellers WHERE seller_id = ?`,
      [vehicle.seller_id]
    );
    if (!selRows[0]) {
      const [selRows2] = await db.query<RowDataPacket[]>(
        `SELECT name FROM seller WHERE seller_id = ?`,
        [vehicle.seller_id]
      );
      sellerName = selRows2[0]?.name ?? null;
    } else {
      sellerName = selRows[0]?.name ?? null;
    }
  } catch {}

  const missingAccess: string[] = [];

  // Check seller access
  console.debug("[checkBuyerAccess] Checking seller access...", {
    buyerId,
    seller_id: vehicle.seller_id,
    category_id: vehicle.vehicle_category_id,
  });
  const [sellerAccess] = await db.query<RowDataPacket[]>(
    `
    SELECT 1 FROM buyer_access_seller 
    WHERE buyer_id = ? AND seller_id = ? AND category_id = ?
    `,
    [buyerId, vehicle.seller_id, vehicle.vehicle_category_id]
  );
  console.debug("[checkBuyerAccess] Seller access result:", sellerAccess);

  if (sellerAccess.length === 0) {
    missingAccess.push(`Not allowed to Bid for Seller ${sellerName ?? String(vehicle.seller_id)}`);
    console.warn("[checkBuyerAccess] Missing seller access", { seller_id: vehicle.seller_id });
  }

  // Check state access
  console.debug("[checkBuyerAccess] Checking state access...", {
    buyerId,
    state_id: vehicle.vehicle_state_id,
    category_id: vehicle.vehicle_category_id,
  });
  const [stateAccess] = await db.query<RowDataPacket[]>(
    `
    SELECT 1 FROM buyer_access_state 
    WHERE buyer_id = ? AND state_id = ? AND category_id = ?
    `,
    [buyerId, vehicle.vehicle_state_id, vehicle.vehicle_category_id]
  );
  console.debug("[checkBuyerAccess] State access result:", stateAccess);

  if (stateAccess.length === 0) {
    missingAccess.push(`Not allowed to Bid for ${stateName ?? String(vehicle.vehicle_state_id)}`);
    console.warn("[checkBuyerAccess] Missing state access", { state_id: vehicle.vehicle_state_id });
  }

  // Check subcategory access
  console.debug("[checkBuyerAccess] Checking subcategory access...", {
    buyerId,
    subcategory_id: vehicle.vehicle_subcategory_id,
    category_id: vehicle.vehicle_category_id,
  });
  const [subcategoryAccess] = await db.query<RowDataPacket[]>(
    `
    SELECT 1 FROM buyer_access_subcategory 
    WHERE buyer_id = ? AND subcategory_id = ? AND category_id = ?
    `,
    [buyerId, vehicle.vehicle_subcategory_id, vehicle.vehicle_category_id]
  );
  console.debug("[checkBuyerAccess] Subcategory access result:", subcategoryAccess);

  if (subcategoryAccess.length === 0) {
    missingAccess.push(`Not allowed to Bid for Sub-category ${subcategoryName ?? String(vehicle.vehicle_subcategory_id)}`);
    console.warn("[checkBuyerAccess] Missing subcategory access", {
      subcategory_id: vehicle.vehicle_subcategory_id,
    });
  }

  // Check vehicle type access
  console.debug("[checkBuyerAccess] Checking vehicle type access...", {
    buyerId,
    vehicle_type_id: vehicle.vehicle_type_id,
    category_id: vehicle.vehicle_category_id,
  });
  const [vehicleTypeAccess] = await db.query<RowDataPacket[]>(
    `
    SELECT 1 FROM buyer_access_vehicletype 
    WHERE buyer_id = ? AND vehicletype_id = ? AND category_id = ?
    `,
    [buyerId, vehicle.vehicle_type_id, vehicle.vehicle_category_id]
  );
  console.debug("[checkBuyerAccess] Vehicle type access result:", vehicleTypeAccess);

  if (vehicleTypeAccess.length === 0) {
    missingAccess.push(`Not allowed to Bid for Vehicle type ${vehicleTypeName ?? String(vehicle.vehicle_type_id)}`);
    console.warn("[checkBuyerAccess] Missing vehicle type access", {
      vehicle_type_id: vehicle.vehicle_type_id,
    });
  }

  const result: BuyerAccessCheck = {
    hasAccess: missingAccess.length === 0,
    missingAccess,
    vehicleInfo: {
      vehicle_id: vehicle.vehicle_id,
      vehicle_type_id: vehicle.vehicle_type_id,
      vehicle_category_id: vehicle.vehicle_category_id,
      vehicle_subcategory_id: vehicle.vehicle_subcategory_id,
      seller_id: vehicle.seller_id,
      vehicle_state_id: vehicle.vehicle_state_id,
    },
  };

  console.debug("[checkBuyerAccess] Final result:", result);

  return result;
}


export async function seedBuyerAccessData(
  buyerId: number,
  sellerIds: number[],
  stateIds: number[],
  subcategoryIds: number[],
  vehicleTypeIds: number[],
  categoryId: number
): Promise<{ [key: string]: number }> {
  const db: Pool = getDb();
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let operations = {
      seller: 0,
      state: 0,
      subcategory: 0,
      vehicletype: 0
    };

    // Insert seller access
    for (const sellerId of sellerIds) {
      await connection.query(`
        INSERT IGNORE INTO buyer_access_seller (id, buyer_id, seller_id, category_id, updated_dttm) 
        VALUES (0, ?, ?, ?, NOW())
      `, [buyerId, sellerId, categoryId]);
      operations.seller++;
    }

    // Insert state access
    for (const stateId of stateIds) {
      await connection.query(`
        INSERT IGNORE INTO buyer_access_state (id, buyer_id, state_id, category_id, updated_dttm) 
        VALUES (0, ?, ?, ?, NOW())
      `, [buyerId, stateId, categoryId]);
      operations.state++;
    }

    // Insert subcategory access
    for (const subcategoryId of subcategoryIds) {
      await connection.query(`
        INSERT IGNORE INTO buyer_access_subcategory (id, buyer_id, category_id, subcategory_id, updated_dttm) 
        VALUES (0, ?, ?, ?, NOW())
      `, [buyerId, categoryId, subcategoryId]);
      operations.subcategory++;
    }

    // Insert vehicle type access
    for (const vehicleTypeId of vehicleTypeIds) {
      await connection.query(`
        INSERT IGNORE INTO buyer_access_vehicletype (id, buyer_id, vehicletype_id, category_id, updated_dttm) 
        VALUES (0, ?, ?, ?, NOW())
      `, [buyerId, vehicleTypeId, categoryId]);
      operations.vehicletype++;
    }

    await connection.commit();
    return operations;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export async function getBuyerAccessSummary(buyerId: number): Promise<{
  seller: number;
  state: number;
  subcategory: number;
  vehicletype: number;
}> {
  const db: Pool = getDb();
  
  const [sellerCount] = await db.query<RowDataPacket[]>(`
    SELECT COUNT(*) as count FROM buyer_access_seller WHERE buyer_id = ?
  `, [buyerId]);

  const [stateCount] = await db.query<RowDataPacket[]>(`
    SELECT COUNT(*) as count FROM buyer_access_state WHERE buyer_id = ?
  `, [buyerId]);

  const [subcategoryCount] = await db.query<RowDataPacket[]>(`
    SELECT COUNT(*) as count FROM buyer_access_subcategory WHERE buyer_id = ?
  `, [buyerId]);

  const [vehicleTypeCount] = await db.query<RowDataPacket[]>(`
    SELECT COUNT(*) as count FROM buyer_access_vehicletype WHERE buyer_id = ?
  `, [buyerId]);

  return {
    seller: sellerCount[0]?.count || 0,
    state: stateCount[0]?.count || 0,
    subcategory: subcategoryCount[0]?.count || 0,
    vehicletype: vehicleTypeCount[0]?.count || 0,
  };
}
