-- Vehicles
CREATE TABLE `vehicles` (
  `vehicle_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_make_id` bigint unsigned NOT NULL,
  `vehicle_model_id` bigint unsigned NOT NULL,
  `vehicle_variant_id` bigint unsigned NOT NULL,
  `manufacturing_year` varchar(10) DEFAULT NULL,
  `vehicle_type_id` bigint unsigned DEFAULT NULL,
  `fuel_type_id` bigint unsigned DEFAULT NULL,
  `transmission_type_id` bigint unsigned DEFAULT NULL,
  `vehicle_ownership_type_id` bigint unsigned DEFAULT NULL,
  `vehicle_category_id` bigint unsigned DEFAULT NULL,
  `vehicle_subcategory_id` bigint unsigned DEFAULT NULL,
  `seller_id` bigint unsigned NOT NULL,
  `regs_no` varchar(100) DEFAULT NULL,
  `vehicle_location` text,
  `vehicle_manager_id` bigint unsigned DEFAULT NULL,
  `base_price` bigint DEFAULT NULL,
  `max_price` bigint DEFAULT NULL,
  `bid_finalised` int unsigned DEFAULT NULL,
  `auction_end_dttm` datetime DEFAULT NULL,
  `additional_remarks` text,
  `notes` text,
  `top_bidder_id` bigint unsigned DEFAULT NULL,
  `added_by_id` bigint unsigned DEFAULT NULL,
  `updated_by_id` bigint unsigned DEFAULT NULL,
  `added_on` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_on` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `address` varchar(25) DEFAULT NULL,
  `auction_start_dttm` datetime DEFAULT NULL,
  `auction_type` tinyint DEFAULT NULL,
  `challan_amt` int DEFAULT NULL,
  `chasis_no` varchar(20) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  `engine_no` varchar(20) DEFAULT NULL,
  `fitness_validity` date DEFAULT NULL,
  `loan_disbursment_dt` date DEFAULT NULL,
  `odometer_reading` int DEFAULT NULL,
  `ownership_serial` varchar(10) DEFAULT NULL,
  `parking_charges` tinyint DEFAULT NULL,
  `pending_challans` int DEFAULT NULL,
  `permit_type` int DEFAULT NULL,
  `permit_validity` date DEFAULT NULL,
  `rc_availability` tinyint DEFAULT NULL,
  `registeration_type_id` int DEFAULT NULL,
  `registration_year` varchar(10) DEFAULT NULL,
  `repo_date` date DEFAULT NULL,
  `reserve_price` bigint DEFAULT NULL,
  `road_tax_validity` varchar(20) DEFAULT NULL,
  `rto_dtls` varchar(255) DEFAULT NULL,
  `running_status` tinyint DEFAULT NULL,
  `seller_manager` varchar(24) DEFAULT NULL,
  `seller_reference` varchar(50) DEFAULT NULL,
  `vehicle_address_zip` varchar(10) DEFAULT NULL,
  `vehicle_city_id` int DEFAULT NULL,
  `vehicle_state_id` int DEFAULT NULL,
  `auction_status_id` int DEFAULT NULL,
  `vehicle_image_id` int DEFAULT NULL,
  `expected_price` bigint DEFAULT NULL,
  `pre_approved_amt` int DEFAULT '0',
  `final_expiry_dttm` datetime DEFAULT NULL,
  `seller_mgr_name` varchar(60) NOT NULL,
  `seller_contact_no` varchar(20) DEFAULT NULL,
  `seller_email` varchar(60) DEFAULT NULL,
  `contact_person_name` varchar(60) NOT NULL,
  `contact_person_contact_no` varchar(20) DEFAULT NULL,
  `vehicle_mgr_name` varchar(60) NOT NULL,
  `vehicle_mgr_contact_no` varchar(20) NOT NULL,
  `vehicle_mgr_email` varchar(60) NOT NULL,
  `owner_name` varchar(60) DEFAULT NULL,
  PRIMARY KEY (`vehicle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `vehicle_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_type` varchar(244) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ownership_serial` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ownership_serial` varchar(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4;

CREATE TABLE `watchlist` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `vehicle_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Vehicle Make
CREATE TABLE IF NOT EXISTS `vehicle_make` (
  `id` int NOT NULL AUTO_INCREMENT,
  `make_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `make_name_UNIQUE` (`make_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vehicle Model
CREATE TABLE IF NOT EXISTS `vehicle_model` (
  `vehicle_model_id` int NOT NULL AUTO_INCREMENT,
  `vehicle_make_id` int NOT NULL,
  `model_name` varchar(100) NOT NULL,
  PRIMARY KEY (`vehicle_model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vehicle Variant
CREATE TABLE IF NOT EXISTS `vehicle_variant` (
  `vehicle_variant_id` int NOT NULL AUTO_INCREMENT,
  `vehicle_model_id` int NOT NULL,
  `variant_name` varchar(100) NOT NULL,
  PRIMARY KEY (`vehicle_variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fuel Types
CREATE TABLE IF NOT EXISTS `fuel_types` (
  `id` int NOT NULL,
  `fuel_type` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vehicle Images
CREATE TABLE IF NOT EXISTS `vehicle_images` (
  `vehicle_image_id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `img_extension` varchar(10) NOT NULL,
  PRIMARY KEY (`vehicle_image_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Case Options
CREATE TABLE IF NOT EXISTS `case_options` (
  `id` int NOT NULL,
  `case_name` varchar(244) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- States
CREATE TABLE IF NOT EXISTS `states` (
  `id` int NOT NULL,
  `state` varchar(255) NOT NULL,
  `region` varchar(100) DEFAULT NULL,
  `rto` char(2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cities
CREATE TABLE IF NOT EXISTS `cities` (
  `city_id` int NOT NULL AUTO_INCREMENT,
  `state_id` int NOT NULL,
  `city` varchar(255) NOT NULL,
  PRIMARY KEY (`city_id`),
  UNIQUE KEY `stateId` (`state_id`,`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Staff
CREATE TABLE IF NOT EXISTS `staff` (
  `staff_id` int NOT NULL AUTO_INCREMENT,
  `staff` varchar(45) DEFAULT NULL,
  `phone` varchar(45) DEFAULT NULL,
  `email` varchar(45) DEFAULT NULL,
  `salt` varchar(45) DEFAULT NULL,
  `hash_password` varchar(200) DEFAULT NULL,
  `added_on` datetime DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL,
  PRIMARY KEY (`staff_id`),
  UNIQUE KEY `phone_UNIQUE` (`phone`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buyer
CREATE TABLE IF NOT EXISTS `buyer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `mobile` varchar(15) NOT NULL,
  `category_id` int NOT NULL,
  `company_name` varchar(100) DEFAULT NULL,
  `case_option_id` tinyint DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `alternate_mobile` varchar(30) DEFAULT NULL,
  `password` varchar(100) DEFAULT NULL,
  `salt` varchar(20) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `city_id` smallint DEFAULT '0',
  `state_id` varchar(255) DEFAULT NULL,
  `pincode` varchar(255) DEFAULT NULL,
  `information_for_buyer` varchar(255) DEFAULT NULL,
  `team_remarks` varchar(255) DEFAULT NULL,
  `pan_number` varchar(20) DEFAULT NULL,
  `aadhaar_number` varchar(20) DEFAULT NULL,
  `security_deposit` int DEFAULT '0',
  `bid_limit` int unsigned DEFAULT 0,
  `expiry_date` date NOT NULL,
  `renew_date` date DEFAULT NULL,
  `buyer_status` tinyint NOT NULL,
  `is_dummy` tinyint(1) NOT NULL DEFAULT '0',
  `verify_status` tinyint(1) NOT NULL DEFAULT '0',
  `police_verification_status` tinyint(1) NOT NULL DEFAULT '0',
  `pan_verification_status` tinyint(1) NOT NULL DEFAULT '0',
  `aadhaar_verification_status` tinyint(1) NOT NULL DEFAULT '0',
  `is_logged_in` tinyint(1) NOT NULL DEFAULT '0',
  `gst_no` varchar(15) DEFAULT NULL,
  `aadhar_doc_id` int DEFAULT NULL,
  `pan_doc_id` int DEFAULT NULL,
  `pcc_doc_id` int DEFAULT NULL,
  `gst_certificate_doc_id` int DEFAULT NULL,
  `other_doc_id` int DEFAULT NULL,
  `img_extn_aadhaar_front` varchar(5) DEFAULT NULL,
  `img_extn_aadhaar_back` varchar(5) DEFAULT NULL,
  `img_extn_pan` varchar(5) DEFAULT NULL,
  `img_extn_cancelled_cheque` varchar(5) DEFAULT NULL,
  `img_extn_pcc` varchar(5) DEFAULT NULL,
  `img_extn_gst` varchar(5) DEFAULT NULL,
  `img_extn_other` varchar(5) DEFAULT NULL,
  `added_on` datetime NOT NULL,
  `added_by` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mobile` (`mobile`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


