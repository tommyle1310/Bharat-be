export interface Seller {
  seller_id?: number;
  seller_type_id: number;
  name: string;
  contact_person?: string | null;
  email: string;
  phone?: string | null;
  salt?: string | null;
  hash_password?: string | null;
  is_dummy?: number | null;
  address?: string | null;
  city_id?: number | null;
  state_id?: number | null;
  pincode?: string | null;
  gst_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SellerListItem {
  seller_id: number;
  name: string;
  contact_person: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city_name?: string | null;
  state_name?: string | null;
  pincode: string | null;
  gst_number: string | null;
  is_dummy: number | null;
  created_at: string | null;
}

export interface SellerSearchParams {
  query?: string;
  limit?: number;
  offset?: number;
}
