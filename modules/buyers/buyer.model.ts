export interface Buyer {
  id?: number;
  name: string;
  mobile: string;
  company_name?: string | null;
  case_option_id?: number | null; // tinyint
  email?: string | null;
  alternate_mobile?: string | null;
  password?: string | null;
  salt?: string | null;
  address?: string | null;
  city_id?: number | null; // smallint
  state_id?: string | null;
  pincode?: string | null;
  information_for_buyer?: string | null;
  team_remarks?: string | null;
  pan_number?: string | null;
  aadhaar_number?: string | null;
  security_deposit?: number | null;
  bid_limit?: number | null;
  expiry_date: string; // date as YYYY-MM-DD
  renew_date?: string | null; // date
  buyer_status: number; // tinyint
  is_dummy?: number | null; // tinyint(1)
  verify_status?: number | null; // tinyint(1)
  police_verification_status?: number | null; // tinyint(1)
  pan_verification_status?: number | null; // tinyint(1)
  aadhaar_verification_status?: number | null; // tinyint(1)
  is_logged_in?: number | null; // tinyint(1)
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
  added_on?: string | null; // datetime
  added_by?: number | null;
}
