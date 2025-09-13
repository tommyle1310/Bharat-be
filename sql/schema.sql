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
INSERT INTO prod_indus_db.vehicles
(vehicle_id, vehicle_make_id, vehicle_model_id, vehicle_variant_id, manufacturing_year, vehicle_type_id, fuel_type_id, transmission_type_id, vehicle_ownership_type_id, vehicle_category_id, vehicle_subcategory_id, seller_id, regs_no, vehicle_location, vehicle_manager_id, base_price, max_price, bid_finalised, auction_end_dttm, additional_remarks, notes, top_bidder_id, bids_count, bidders_count, added_by_id, updated_by_id, added_on, updated_on, address, auction_start_dttm, auction_type, challan_amt, chasis_no, color, engine_no, fitness_validity, loan_disbursment_dt, odometer_reading, ownership_serial, parking_charges, pending_challans, permit_type, permit_validity, rc_availability, registeration_type_id, registration_year, repo_date, reserve_price, road_tax_validity, rto_dtls, running_status, seller_manager, seller_reference, vehicle_address_zip, vehicle_city_id, vehicle_state_id, auction_status_id, vehicle_image_id, expected_price, pre_approved_amt, final_expiry_dttm, seller_mgr_name, seller_contact_no, seller_email, contact_person_name, contact_person_contact_no, vehicle_mgr_name, vehicle_mgr_contact_no, vehicle_mgr_email, owner_name, case_option_id)
VALUES(0, 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, '', '', 0, 0, 0, 0, '', '', '', 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '', '', 0, 0, '', '', '', '', '', 0, '', 0, 0, 0, '', 0, 0, '', '', 0, '', '', 0, '', '', '', 0, 0, 0, 0, 0, 0, '', '', '', '', '', '', '', '', '', '', 0);

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