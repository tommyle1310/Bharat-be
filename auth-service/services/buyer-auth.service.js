const crypto = require('crypto');
const logger = require('../../utils/logger/logger');
const authRepo = require('../repositories/buyer-auth.repository');
const redis = require('../../redis/redisClient');
const { generateToken, decodeAndVerifyToken, generateRefreshToken } = require('../../utils/auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

exports.register = async (req, res) => {
  const { phone, name, email, password, category, address, state_id, city_id, aadhaar_number, pan_number, company_name , pin_number } = req.body || {};

  if (!phone || !name || !password || !email) {
    logger.warn('Registration validation failed: missing required fields');
    return res.status(400).json({ message: 'phone, name, email, and password are required' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPwd = hashPassword(password, salt);

  try {
    // Coerce undefined to null for optional fields to satisfy MySQL driver
    const safeCategory = category ?? null;
    const safeAddress = address ?? null;
    const safeStateId = state_id ?? null;
    const safeCityId = city_id ?? null;
    const safeAadhaar = aadhaar_number ?? null;
    const safePan = pan_number ?? null;
    const safeCompany = company_name ?? null;
    const safePincode = pin_number ?? null;

    await authRepo.createBuyer(
      name,
      email,
      phone,
      hashedPwd,
      salt,
      safeCategory,
      safeAddress,
      safeStateId,
      safeCityId,
      safeAadhaar,
      safePan,
      safeCompany,
      safePincode
    );
    logger.info(`Buyer registered with phone ${phone}`);
    res.status(201).json({ message: 'Buyer registered' });
  } catch (err) {
    logger.error(`Registration failed for phone ${phone}: ${err.message}`);
    res.status(500).json({ message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  const { phone, password } = req.body || {};
  logger.info(`Login attempt for phone: ${phone}`);

  if (!phone || !password) {
    logger.warn('Login validation failed: phone or password missing');
    return res.status(400).json({ message: 'phone and password are required' });
  }

  try {
    const user = await authRepo.getBuyerByPhone(phone);
    if (!user) {
      logger.warn(`Login failed: No user found for phone ${phone}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const hashed = hashPassword(password, user.salt);
    if (hashed !== user.password) {
      logger.warn(`Login failed: Incorrect password for phone ${phone}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, userType: 'buyer', phoneNo: user.mobile });
    const refreshToken = generateRefreshToken({ id: user.id, userType: 'buyer', phoneNo: user.mobile });
    logger.info(`Login successful for phone: ${phone}`);
    res.json({ token, refreshToken, category: user.category_id });
  } catch (err) {
    logger.error(`Login error for phone ${phone}: ${err.message}`);
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
    const redisKey = `access:${decoded.id}:${decoded.userType}:${token}`;

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