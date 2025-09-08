const crypto = require('crypto');
const logger = require('../../utils/logger/logger');
const authRepo = require('../repositories/company-auth.repository');
const redis = require('../../redis/redisClient');
const { generateToken, decodeAndVerifyToken,  generateRefreshToken, verifyRefreshToken } = require('../../utils/auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

exports.register = async (req, res) => {
  const { phoneNo, name, password, role } = req.body;
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPwd = hashPassword(password, salt);

  try {
    await authRepo.createUser(name, phoneNo, hashedPwd, salt, role);
    logger.info(`User created with phoneNo ${phoneNo}`);
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    logger.error(`User creation failed for phoneNo ${phoneNo}: ${err.message}`);
    res.status(500).json({ message: 'User creation failed' });
  }
};

exports.login = async (req, res) => {
  const { phoneNo, password } = req.body;
  logger.info(`Login attempt for staff phone: ${phoneNo}`);

  try {
    const user = await authRepo.getUserByPhone(phoneNo);
    if (!user) {
      logger.warn(`Login failed: No staff found for phone ${phoneNo}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const hashed = hashPassword(password, user.salt);
   
    if (hashed !== user.hashPassword) {
      logger.warn(`Login failed: Incorrect password for phone ${phoneNo}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.staffId, userType: 'staff', phoneNo: user.phone });
    const refreshToken = generateRefreshToken({ id: user.staffId, userType: 'staff', phoneNo: user.phone });
    logger.info(`Login successful for phone: ${phoneNo}`);
    res.json({ token, refreshToken });
  } catch (err) {
    logger.error(`Login error for phone ${phoneNo}: ${err.message}`);
    res.status(500).json({ message: 'Login failed' });
  }
};

exports.refreshToken = async (req, res) => {
  console.log('refreshToken() service called', req.body);
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const userData = await verifyRefreshToken(refreshToken);

    const newAccessToken = generateToken({
      id: userData.id,
      userType: userData.userType
    });

    res.status(200).json({ accessToken: newAccessToken });

  } catch (err) {
    res.status(403).json({ message: err.message });
  }
}
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