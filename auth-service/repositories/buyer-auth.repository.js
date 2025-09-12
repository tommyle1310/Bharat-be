const db = require("../../database/mysql/db-index");
const logger = require("../../../shared/utils/logger/logger");

exports.createBuyer = async (name, email, mobile, business_vertical, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode) => {
  logger.info(`Creating buyer with phone: ${mobile}`);
  try {
    const [result] = await db.execute(
      "INSERT INTO buyers (name, email, mobile, business_vertical, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode, expiry_date, buyer_status, verify_status, is_dummy, notification_opened, added_on, police_verification_status, pan_verification_status, aadhaar_verification_status, is_logged_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 30, 0, 0, 0, NOW(), 0, 0, 0, 0)",
      [name, email, mobile, business_vertical, address, state_id, city_id, aadhaar_number, pan_number, company_name, pincode]
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
  try {
    const [rows] = await db.execute(
      "SELECT id FROM buyers WHERE mobile = ? LIMIT 1",
      [mobile]
    );
    return rows && rows.length > 0;
  } catch (err) {
    logger.error(`Error checking phone exists ${mobile}: ${err.message}`);
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

// Insert a row into buyer_doc_images and return its generated doc_image_id
exports.insertBuyerDocImage = async (imgExtension) => {
  logger.info(`Inserting buyer_doc_image with extension: ${imgExtension}`);
  try {
    const [result] = await db.execute(
      "INSERT INTO buyer_doc_images (img_extension) VALUES (?)",
      [imgExtension]
    );
    return { docImageId: result.insertId };
  } catch (err) {
    logger.error(`Error inserting buyer_doc_image: ${err.message}`);
    throw err;
  }
};

// Update buyer document id references
exports.updateBuyerDocIds = async (
  buyerId,
  { panDocId = null, aadhaarFrontDocId = null, aadhaarBackDocId = null }
) => {
  logger.info(
    `Updating buyer ${buyerId} doc ids: pan=${panDocId}, a_front=${aadhaarFrontDocId}, a_back=${aadhaarBackDocId}`
  );
  try {
    const [result] = await db.execute(
      `UPDATE buyers 
       SET pan_doc_id = COALESCE(?, pan_doc_id), 
           aadhar_front_doc_id = COALESCE(?, aadhar_front_doc_id), 
           aadhar_back_doc_id = COALESCE(?, aadhar_back_doc_id)
       WHERE id = ?`,
      [panDocId, aadhaarFrontDocId, aadhaarBackDocId, buyerId]
    );
    return result;
  } catch (err) {
    logger.error(
      `Error updating buyer ${buyerId} doc ids: ${err.message}`
    );
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
    logger.info(`Fetched buyer by phone: ${mobile}, salt: ${users[0].salt}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching buyer by phone ${mobile}: ${err.message}`);
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