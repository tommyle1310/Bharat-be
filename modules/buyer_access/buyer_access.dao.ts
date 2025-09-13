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
  
  // First, get vehicle information
  const [vehicleRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      vehicle_id,
      vehicle_type_id,
      vehicle_category_id,
      vehicle_subcategory_id,
      seller_id,
      vehicle_state_id
    FROM vehicles 
    WHERE vehicle_id = ?
  `, [vehicleId]);

  if (vehicleRows.length === 0) {
    throw new Error('Vehicle not found');
  }

  const vehicle = vehicleRows[0];
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  
  const missingAccess: string[] = [];

  // Check seller access
  const [sellerAccess] = await db.query<RowDataPacket[]>(`
    SELECT 1 FROM buyer_access_seller 
    WHERE buyer_id = ? AND seller_id = ? AND category_id = ?
  `, [buyerId, vehicle.seller_id, vehicle.vehicle_category_id]);

  if (sellerAccess.length === 0) {
    missingAccess.push(`seller (ID: ${vehicle.seller_id})`);
  }

  // Check state access
  const [stateAccess] = await db.query<RowDataPacket[]>(`
    SELECT 1 FROM buyer_access_state 
    WHERE buyer_id = ? AND state_id = ? AND category_id = ?
  `, [buyerId, vehicle.vehicle_state_id, vehicle.vehicle_category_id]);

  if (stateAccess.length === 0) {
    missingAccess.push(`state (ID: ${vehicle.vehicle_state_id})`);
  }

  // Check subcategory access
  const [subcategoryAccess] = await db.query<RowDataPacket[]>(`
    SELECT 1 FROM buyer_access_subcategory 
    WHERE buyer_id = ? AND subcategory_id = ? AND category_id = ?
  `, [buyerId, vehicle.vehicle_subcategory_id, vehicle.vehicle_category_id]);

  if (subcategoryAccess.length === 0) {
    missingAccess.push(`subcategory (ID: ${vehicle.vehicle_subcategory_id})`);
  }

  // Check vehicle type access
  const [vehicleTypeAccess] = await db.query<RowDataPacket[]>(`
    SELECT 1 FROM buyer_access_vehicletype 
    WHERE buyer_id = ? AND vehicletype_id = ? AND category_id = ?
  `, [buyerId, vehicle.vehicle_type_id, vehicle.vehicle_category_id]);

  if (vehicleTypeAccess.length === 0) {
    missingAccess.push(`vehicle type (ID: ${vehicle.vehicle_type_id})`);
  }

  return {
    hasAccess: missingAccess.length === 0,
    missingAccess,
    vehicleInfo: {
      vehicle_id: vehicle.vehicle_id,
      vehicle_type_id: vehicle.vehicle_type_id,
      vehicle_category_id: vehicle.vehicle_category_id,
      vehicle_subcategory_id: vehicle.vehicle_subcategory_id,
      seller_id: vehicle.seller_id,
      vehicle_state_id: vehicle.vehicle_state_id,
    }
  };
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
