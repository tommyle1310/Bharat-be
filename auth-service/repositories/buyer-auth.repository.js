const db = require("../../database/mysql/db-index");
const logger = require("../../../shared/utils/logger/logger");

exports.createBuyer = async (name, mobile, pwd, salt, category, address, state_id, city_id, aadhaar_number, pan_number, company_name) => {
  logger.info(`Creating buyer with phone: ${mobile}`);
  try {
    const result = await db.execute(
      "INSERT INTO buyers (name, mobile, password, salt, category_id, address, state_id, city_id, aadhaar_number, pan_number, company_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name, mobile, pwd, salt, category, address, state_id, city_id, aadhaar_number, pan_number, company_name]
    );
    logger.info(`Buyer created with phone: ${mobile}`);
    return result;
  } catch (err) {
    logger.error(`Error creating buyer with phone ${mobile}: ${err.message}`);
    throw err;
  }
};

exports.getBuyerByPhone = async (mobile) => {
  logger.info(`Fetching buyer by phone: ${phone}`);
  try {
    const [users] = await db.execute("SELECT * FROM buyers WHERE mobile = ?", [
      phone,
    ]);
    logger.info(`Fetched buyer by phone: ${phone}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching buyer by phone ${phone}: ${err.message}`);
    throw err;
  }
};
