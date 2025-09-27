const db = require('../../database/mysql/db-index');
const logger = require('../../utils/logger/logger');

exports.createUser = async (name, phoneNo, pwd, salt, role) => {
  logger.info(`Creating user with phone: ${phoneNo}`);
  try {
    const result = await db.execute(
      'INSERT INTO user (name, phoneNo, pwd, salt, role) VALUES (?, ?, ?, ?, ?)',
      [name, phoneNo, pwd, salt, role]
    );
    logger.info(`User created with phone: ${phoneNo}`);
    return result;
  } catch (err) {
    logger.error(`Error creating buyer with phone ${phoneNo}: ${err.message}`);
    throw err;
  }
};

exports.getUserByPhone = async (phoneNo) => {
  logger.info(`Fetching staff by phone: ${phoneNo}`);
  try {
    const [users] = await db.execute('SELECT staff_id AS staffId, staff, phone, email, salt, hash_password AS hashPassword, added_on AS addedOn, updated_on AS updatedOn FROM staff WHERE phone = ?', [phoneNo]);
    logger.info(`Fetched staff by phone: ${phoneNo}`);
    return users[0];
  } catch (err) {
    logger.error(`Error fetching staff by phone ${phoneNo}: ${err.message}`);
    throw err;
  }
};
