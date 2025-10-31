all the ...dttm is datetime

INSERT INTO prod_indus_db.buyer_preference_make
(id, buyer_id, make_id, category_id, is_surrogate, updated_dttm)
VALUES(0, 0, 0, 0, 0, '');
INSERT INTO prod_indus_db.buyer_preference_regstate
(id, buyer_id, state_id, category_id, is_surrogate, updated_dttm)
VALUES(0, 0, 0, 0, 0, '');
INSERT INTO prod_indus_db.buyer_preference_seller
(id, buyer_id, seller_id, is_surrogate, updated_dttm, category_id)
VALUES(0, 0, 0, 0, '', 0);
INSERT INTO prod_indus_db.buyer_preference_state
(id, buyer_id, state_id, category_id, is_surrogate, updated_dttm)
VALUES(0, 0, 0, 0, 0, '');
INSERT INTO prod_indus_db.buyer_preference_subcategory
(id, buyer_id, category_id, subcategory_id, is_surrogate, updated_dttm)
VALUES(0, 0, 0, 0, 1, '');
INSERT INTO prod_indus_db.buyer_preference_vehicletype
(id, buyer_id, vehicletype_id, category_id, is_surrogate, updated_dttm)
VALUES(0, 0, 0, 0, 0, '');
INSERT INTO prod_indus_db.vehicle_make
(id, make_name)
VALUES(0, '');
INSERT INTO prod_indus_db.vehicle_model
(vehicle_model_id, vehicle_make_id, model_name)
VALUES(0, 0, '');
INSERT INTO prod_indus_db.vehicle_ownership_type
(ownership_type_id, ownership_type)
VALUES(0, '');
INSERT INTO prod_indus_db.vehicle_subcategory
(sub_category_id, category_id, sub_category)
VALUES(0, 0, '');
INSERT INTO prod_indus_db.vehicle_types
(id, vehicle_type)
VALUES(0, '');
INSERT INTO prod_indus_db.vehicle_variant
(vehicle_variant_id, vehicle_model_id, variant_name)
VALUES(0, 0, '');

SELECT vehicle_id, vehicle_make_id, vehicle_model_id, vehicle_variant_id, manufacturing_year, vehicle_type_id, fuel_type_id, transmission_type_id, vehicle_ownership_type_id, vehicle_category_id, vehicle_subcategory_id, seller_id, regs_no, vehicle_location, vehicle_manager_id, base_price, max_price, bid_finalised, auction_end_dttm, additional_remarks, notes, top_bidder_id, bids_count, bidders_count, added_by_id, updated_by_id, added_on, updated_on, address, auction_start_dttm, auction_type, challan_amt, chasis_no, color, engine_no, fitness_validity, loan_disbursment_dt, odometer_reading, ownership_serial, parking_charges, pending_challans, permit_type, permit_validity, rc_availability, registeration_type_id, registration_year, repo_date, reserve_price, road_tax_validity, rto_dtls, running_status, seller_manager, seller_reference, vehicle_city_id, vehicle_state_id, auction_status_id, vehicle_image_id, expected_price, pre_approved_amt, final_expiry_dttm, seller_mgr_name, seller_contact_no, seller_email, yard_contact_person_name, contact_person_contact_no, vehicle_mgr_name, vehicle_mgr_contact_no, vehicle_mgr_email, owner_name, case_option_id, yard_address, yard_city_id, yard_state_id, bid_limit, intimation_dt, superdari_status, transit_vehicle, damage_description, `keys`, auto, luxury, bid_type, road_tax_pending_amt, regs_state_id, vahan_reg_no, vahan_chassis, vahan_engine, vahan_vehicle_manufacturer_name, vahan_model, vahan_color, vahan_fuel_type, vahan_norms_type, vahan_body_type, vahan_owner_count, vahan_owner_name, vahan_owner_father, vahan_mobile, vahan_vehicle_status, vahan_status_dt, vahan_reg_authority, vahan_reg_dt, vahan_manufacturing_month_year, vahan_rc_expiry_dt, vahan_tax_expiry_dt, vahan_insurance_company, vahan_insurance_expiry_dt, vahan_insurance_policy, vahan_rc_financer, vahan_present_address, vahan_permanent_address, vahan_cubic_capacity, vahan_gross_weight, vahan_unladen_weight, vahan_category, vahan_rc_standard_cap, vahan_cylinders_no, vahan_seat_capacity, vahan_sleeper_capacity, vahan_standing_capacity, vahan_wheelbase, vahan_vehicle_no, vahan_pucc_no, vahan_pucc_expiry_dt, vahan_blacklist_status, vahan_blacklist_remarks, vahan_permit_issue_dt, vahan_permit_no, vahan_permit_type, vahan_permit_validity_start_dt, vahan_permit_validity_expiry_dt, vahan_non_use_status, vahan_non_use_start_dt, vahan_non_use_expiry_dt, vahan_national_permit_no, vahan_national_permit_expiry_dt, vahan_national_permit_issued_by, vahan_commercial, vahan_noc_dtls, vahan_db_result, vahan_partial_data, vahan_mmv_response, vahan_financed, vahan_class, vahan_dtls_updated, vahan_dtls_updated_dttm, vahan_dtls_updated_by, challan_dtls_updated, challan_dtls_updated_dttm, challan_dtls_updated_by, yard_address_zip, ack_no, seller_save_status, seller_last_save_dttm, appr_amt, appr_reject_dt, appr_reject_remarks, appr_reject_action_dttm, appr_reject_action_by, quote_revision_dt, quote_revision_remarks, quote_revision_action_dttm, quote_revision_action_by, reauction_reason, reauction_action_dttm, reauction_action_by, flg_reauction_with_bids, reauctioned_from_vehicle_id, payment_dtls_remarks, payment_dtls_action_dttm, payment_dtls_action_by, payment_completed_action_by, buyer_backout_dt, forfeit_amt, buyer_backout_action_dttm, buyer_backout_action_by, payment_completed, payment_completed_action_dttm, updated_by_seller_id, bucket_id
FROM prod_indus_db.vehicles;

SELECT bucket_id, bucket_nm, seller_id, vehicle_type_id, auction_start_dttm, auction_end_dttm
FROM prod_indus_db.bucket;


INSERT INTO prod_indus_db.states
(id, state, region)
VALUES(0, '', '');
INSERT INTO prod_indus_db.vehicle_subcategory
(sub_category_id, category_id, sub_category)
VALUES(0, 0, '');

INSERT INTO prod_indus_db.buyer_access_seller
(id, buyer_id, seller_id, category_id, updated_dttm)
VALUES(0, 0, 0, 0, '');
INSERT INTO prod_indus_db.buyer_access_state
(id, buyer_id, state_id, updated_dttm, category_id)
VALUES(0, 0, 0, '', 0);
INSERT INTO prod_indus_db.buyer_access_subcategory
(id, buyer_id, category_id, subcategory_id, updated_dttm)
VALUES(0, 0, 0, 0, '');
INSERT INTO prod_indus_db.buyer_access_vehicletype
(id, buyer_id, vehicletype_id, category_id, updated_dttm)
VALUES(0, 0, 0, 0, '');


INSERT INTO prod_indus_db.buyers
(id, name, company_name, case_option_id, email, mobile, alternate_mobile, password, address, city, state_id, pincode, information_for_buyer, team_remarks, pan_number, aadhaar_number, security_deposit, expiry_date, renew_date, buyer_status, buyer_zone, interested_states, aadhaar_front, aadhaar_back, pan_image, police_verification, verify_status, is_dummy, firebase_token, notification_opened, added_on, reset_token, police_verification_status, pan_verification_status, aadhaar_verification_status, is_logged_in, category_id, gst_no, aadhar_front_doc_id, aadhar_back_doc_id, pan_doc_id, pcc_doc_id, gst_certificate_doc_id, other_doc_id, city_id, salt, business_vertical)
VALUES(0, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 0, '', '', '', '', '', '', 0, 0, '', 0, '', '', 0, 0, 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, '', '');

INSERT INTO prod_indus_db.auction_status
(auction_status_id, auction_status)
VALUES(0, '');