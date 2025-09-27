import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "../../config/database";
import { Seller, SellerListItem, SellerSearchParams } from "./seller.model";

const SELLERS_TABLE = "seller";

export async function getAllSellers(limit = 50, offset = 0): Promise<SellerListItem[]> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 
      s.seller_id,
      s.name,
      s.contact_person,
      s.email,
      s.phone,
      s.address,
      c.city,
      st.state,
      s.pincode,
      s.gst_number,
      s.is_dummy,
      s.created_at
    FROM ${SELLERS_TABLE} s
    LEFT JOIN cities c ON s.city_id = c.city_id
    LEFT JOIN states st ON s.state_id = st.id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  return rows.map((row) => ({
    seller_id: row.seller_id,
    name: row.name,
    contact_person: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city_name: row.city,
    state_name: row.state,
    pincode: row.pincode,
    gst_number: row.gst_number,
    is_dummy: row.is_dummy,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

export async function searchSellers(params: SellerSearchParams): Promise<SellerListItem[]> {
  const db: Pool = getDb();
  const { query = '', limit = 50, offset = 0 } = params;
  
  if (!query.trim()) {
    return getAllSellers(limit, offset);
  }
  
  const searchTerm = `%${query.trim()}%`;
  
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 
      s.seller_id,
      s.name,
      s.contact_person,
      s.email,
      s.phone,
      s.address,
      c.city,
      st.state,
      s.pincode,
      s.gst_number,
      s.is_dummy,
      s.created_at
    FROM ${SELLERS_TABLE} s
    LEFT JOIN cities c ON s.city_id = c.city_id
    LEFT JOIN states st ON s.state_id = st.id
    WHERE 
      s.name LIKE ? 
      OR s.email LIKE ? 
      OR s.contact_person LIKE ?
      OR s.phone LIKE ?
      OR s.gst_number LIKE ?
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?`,
    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit, offset]
  );
  
  return rows.map((row) => ({
    seller_id: row.seller_id,
    name: row.name,
    contact_person: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city_name: row.city,
    state_name: row.state,
    pincode: row.pincode,
    gst_number: row.gst_number,
    is_dummy: row.is_dummy,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

export async function getSellerById(sellerId: number): Promise<Seller | null> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM ${SELLERS_TABLE} WHERE seller_id = ? LIMIT 1`,
    [sellerId]
  );
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  if (!row) return null;
  
  return {
    seller_id: row.seller_id,
    seller_type_id: row.seller_type_id,
    name: row.name,
    contact_person: row.contact_person,
    email: row.email,
    phone: row.phone,
    salt: row.salt,
    hash_password: row.hash_password,
    is_dummy: row.is_dummy,
    address: row.address,
    city_id: row.city_id,
    state_id: row.id,
    pincode: row.pincode,
    gst_number: row.gst_number,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function getSellersCount(): Promise<number> {
  const db: Pool = getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM ${SELLERS_TABLE}`
  );
  
  return rows[0]?.count || 0;
}

export async function getSellersSearchCount(query: string): Promise<number> {
  const db: Pool = getDb();
  
  if (!query.trim()) {
    return getSellersCount();
  }
  
  const searchTerm = `%${query.trim()}%`;
  
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM ${SELLERS_TABLE} s
    WHERE 
      s.name LIKE ? 
      OR s.email LIKE ? 
      OR s.contact_person LIKE ?
      OR s.phone LIKE ?
      OR s.gst_number LIKE ?`,
    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
  );
  
  return rows[0]?.count || 0;
}
