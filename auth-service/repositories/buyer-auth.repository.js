const db = require("../../database/mysql/db-index");
const logger = require("../../../shared/utils/logger/logger");

exports.createBuyer = async (name, email, mobile, pwd, salt, category, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode) => {
  logger.info(`Creating buyer with phone: ${mobile}`);
  try {
    const result = await db.execute(
      "INSERT INTO buyers (name, email, mobile, password, salt, category_id, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode, expiry_date, buyer_status, verify_status, is_dummy, notification_opened, added_on, police_verification_status, pan_verification_status, aadhaar_verification_status, is_logged_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 1, 0, 0, 0, NOW(), 0, 0, 0, 0)",
      [name, email, mobile, pwd, salt, category, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode]
    );
    logger.info(`Buyer created with phone: ${mobile}`);
    return result;
  } catch (err) {
    logger.error(`Error creating buyer with phone ${mobile}: ${err.message}`);
    throw err;
  }
};

exports.getBuyerByPhone = async (mobile) => {
  logger.info(`Fetching buyer by phone: ${mobile}`);
  try {
    const [users] = await db.execute(
      "SELECT id, mobile, password, salt, category_id FROM buyers WHERE mobile = ?",
      [mobile]
    );
    logger.info(`Fetched buyer by phone: ${mobile}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching buyer by phone ${mobile}: ${err.message}`);
    throw err;
  }
};
