const db = require("../../database/mysql/db-index");
const logger = require("../../../shared/utils/logger/logger");

exports.createBuyer = async (
  name,
  email,
  mobile,
  business_vertical,
  address,
  state_id,
  city_id,
  aadhaar_number,
  pan_number,
  company_name,
  pincode
) => {
  logger.info(`Creating buyer with phone: ${mobile}`);
  try {
    const [result] = await db.execute(
      `INSERT INTO buyers (
        name, email, mobile, business_vertical, address,
        state_id, city_id,
        aadhaar_number, pan_number, company_name, pincode,
        expiry_date, buyer_status, verify_status, is_dummy, notification_opened,
        added_on, police_verification_status, pan_verification_status,
        aadhaar_verification_status, is_logged_in
      ) VALUES (
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        ?, ?,
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        CONVERT(? USING utf8mb4),
        ?,
        CURDATE(), 30, 0, 0, 0, NOW(), 0, 0, 0, 0
      )`,
      [name, email, mobile, business_vertical, address,
       state_id, city_id,
       aadhaar_number, pan_number, company_name, pincode]
    );

    logger.info(`Buyer created with phone: ${mobile}`);
    return { insertId: result.insertId };
  } catch (err) {
    logger.error(`Error creating buyer with phone ${mobile}: ${err.message}`);
    throw err;
  }
};


// Existence checks
exports.existsBuyerByPhone = async (mobile) => {
  // Ensure mobile is not undefined - convert to null for SQL safety
  if (mobile === undefined) {
    logger.error('existsBuyerByPhone called with undefined mobile');
    return false;
  }
  const safeMobile = mobile || null;
  
  try {
    const [rows] = await db.execute(
      "SELECT id FROM buyers WHERE mobile = ? LIMIT 1",
      [safeMobile]
    );
    return rows && rows.length > 0;
  } catch (err) {
    logger.error(`Error checking phone exists ${safeMobile}: ${err.message}`);
    throw err;
  }
};

exports.existsBuyerByEmail = async (email) => {
  try {
    const [rows] = await db.execute(
      "SELECT id FROM buyers WHERE email = ? LIMIT 1",
      [email]
    );
    return rows && rows.length > 0;
  } catch (err) {
    logger.error(`Error checking email exists ${email}: ${err.message}`);
    throw err;
  }
};



exports.getBuyerByPhone = async (mobile) => {
  // Ensure mobile is not undefined - convert to null for SQL safety
  if (mobile === undefined) {
    logger.error('getBuyerByPhone called with undefined mobile');
    throw new Error('Mobile parameter cannot be undefined');
  }
  const safeMobile = mobile || null;
  
  logger.info(`Fetching buyer by phone: ${safeMobile}`);
  try {
    const [users] = await db.execute(
      "SELECT id, mobile, password, salt, category_id FROM buyers WHERE mobile = ?",
      [safeMobile]
    );
    if (users && users.length > 0) {
      logger.info(`Fetched buyer by phone: ${safeMobile}, salt: ${users[0].salt}`);
      return users[0];
    }
    return null;
  } catch (err) {
    logger.error(`Error fetching buyer by phone ${safeMobile}: ${err.message}`);
    throw err;
  }
};

// Get buyer by email
exports.getBuyerByEmail = async (email) => {
  logger.info(`Fetching buyer by email: ${email}`);
  try {
    const [users] = await db.execute(
      "SELECT id, name, email FROM buyers WHERE email = ?",
      [email]
    );
    logger.info(`Fetched buyer by email: ${email}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching buyer by email ${email}: ${err.message}`);
    throw err;
  }
};

// Update buyer password (and salt) by email
exports.updateBuyerPasswordByEmail = async (email, hashedPassword, salt) => {
  logger.info(`Updating buyer password by email: ${email}`);
  try {
    const [result] = await db.execute(
      "UPDATE buyers SET password = ?, salt = ? WHERE email = ?",
      [hashedPassword, salt, email]
    );
    logger.info(`Updated password for buyer email: ${email}`);
    return result;
  } catch (err) {
    logger.error(`Error updating password for email ${email}: ${err.message}`);
    throw err;
  }
};