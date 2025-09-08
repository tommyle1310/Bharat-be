const db = require('../../../shared/database/mysql/db-index');
const logger = require('../../utils/logger/logger');

exports.createSeller = async (name, phoneNo, pwd, salt, category) => {
  logger.info(`Creating seller with phone: ${phoneNo}`);
  try {
    const result = await db.execute(
      'INSERT INTO seller (name, phoneNo, pwd, salt, category) VALUES (?, ?, ?, ?, ?)',
      [name, phoneNo, pwd, salt, category]
    );
    logger.info(`Seller created with phone: ${phoneNo}`);
    return result;
  } catch (err) {
    logger.error(`Error creating seller with phone ${phoneNo}: ${err.message}`);
    throw err;
  }
};

exports.getSellerByPhone = async (phoneNo) => {
  logger.info(`Fetching seller by phone: ${phoneNo}`);
  try {
    const [users] = await db.execute('SELECT * FROM seller WHERE phoneNo = ?', [phoneNo]);
    logger.info(`Fetched seller by phone: ${phoneNo}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching seller by phone ${phoneNo}: ${err.message}`);
    throw err;
  }
};
