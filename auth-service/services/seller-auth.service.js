const crypto = require('crypto');
const logger = require('../../utils/logger/logger');
const authRepo = require('../repositories/seller-auth.repository');
const redis = require('../../redis/redisClient');

const { generateToken, decodeAndVerifyToken } = require('../../utils/auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

exports.register = async (req, res) => {
  const { phoneNo, name, password, category } = req.body;
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPwd = hashPassword(password, salt);

  try {
    await authRepo.createSeller(name, phoneNo, hashedPwd, salt, category);
    logger.info(`Seller registered with phone ${phoneNo}`);
    res.status(201).json({ message: 'Seller registered' });
  } catch (err) {
    logger.error(`Registration failed for phone ${phoneNo}: ${err.message}`);
    res.status(500).json({ message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  const { phoneNo, password } = req.body;
  logger.info(`Login attempt for phone: ${phoneNo}`);

  try {
    const user = await authRepo.getSellerByPhone(phoneNo);
    if (!user) {
      logger.warn(`Login failed: No user found for phone ${phoneNo}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const hashed = hashPassword(password, user.salt);
    if (hashed !== user.pwd) {
      logger.warn(`Login failed: Incorrect password for phone ${phoneNo}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.sellerId, userType: 'seller', phoneNo: user.phoneNo });
    logger.info(`Login successful for phone: ${phoneNo}`);
    res.json({ token });
  } catch (err) {
    logger.error(`Login error for phone ${phoneNo}: ${err.message}`);
    res.status(500).json({ message: 'Login failed' });
  }
};


exports.logout = async (req, res) => {
  const auth = req.headers['authorization'];
  logger.info('Logout endpoint called');

  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn('No token provided for logout');
    return res.status(401).json({ message: 'Missing token' });
  }

  const token = auth.split(' ')[1];

  try {
    const decoded = await decodeAndVerifyToken(token);
    // console.log("decoded", decoded);
    const redisKey = `auth:${decoded.id}:${decoded.userType}:${token}`;

    const deleted = await redis.del(redisKey);

    if (deleted) {
      logger.info(`Token removed from Redis for userId ${decoded.id}`);
      res.json({ message: 'Logged out successfully' });
    } else {
      logger.warn(`No token found in Redis for userId ${decoded.id}`);
      res.status(404).json({ message: 'Token not found or already expired' });
    }
  } catch (err) {
    logger.error(`Logout failed: ${err.message}`);
    res.status(403).json({ message: 'Invalid token' });
  }
};

exports.verify = async (req, res) => {
  const auth = req.headers['authorization'];
  logger.info('Verify endpoint called');
  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn('Missing token in authorization header');
    return res.status(401).json({ message: 'Missing token' });
  }

  const token = auth.split(' ')[1];
  try {
    const user = await decodeAndVerifyToken(token); // now async
    logger.info('Token verified successfully');
    res.json({ message: 'Token valid', user });
  } catch (err) {
    logger.warn(`Invalid or expired token: ${err.message}`);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};