const crypto = require('crypto');
// const logger = require('../../utils/logger/logger');
// const authRepo = require('../repositories/buyer-auth.repository');
// const redis = require('../../redis/redisClient');
// const { generateToken, decodeAndVerifyToken } = require('../../utils/auth');

export function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}
