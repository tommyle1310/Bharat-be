export interface Buyer {
  buyer_id?: number;
  name: string;
  mobile: string;
  business_vertical: string;
  company_name?: string | null;
  case_option_id?: number | null;
  email?: string | null;
  alternate_mobile?: string | null;
  password?: string | null;
  salt?: string | null;
  address?: string | null;
  city_id?: number | null;
  state_id?: string | null;
  pincode?: string | null;
  information_for_buyer?: string | null;
  team_remarks?: string | null;
  pan_number?: string | null;
  aadhaar_number?: string | null;
  security_deposit?: number | null;
  bid_limit?: number | null;
  expiry_date: string;
  renew_date?: string | null;
  buyer_status: number;
  is_dummy?: number;
  verify_status?: number;
  police_verification_status?: number;
  pan_verification_status?: number;
  aadhaar_verification_status?: number;
  is_logged_in?: number;
  gst_no?: string | null;
  aadhar_doc_id?: number | null;
  pan_doc_id?: number | null;
  pcc_doc_id?: number | null;
  gst_certificate_doc_id?: number | null;
  other_doc_id?: number | null;
  img_extn_aadhaar_front?: string | null;
  img_extn_aadhaar_back?: string | null;
  img_extn_pan?: string | null;
  img_extn_cancelled_cheque?: string | null;
  img_extn_pcc?: string | null;
  img_extn_gst?: string | null;
  img_extn_other?: string | null;
  added_on: string;
  added_by: number;
}


