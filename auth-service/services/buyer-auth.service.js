const crypto = require('crypto');
const logger = require('../../utils/logger/logger');
const authRepo = require('../repositories/buyer-auth.repository');
const redis = require('../../redis/redisClient');
const { generateToken, decodeAndVerifyToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/auth');
const nodemailer = require('nodemailer');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Backward-compat: some legacy users may have been hashed using Buffer(hexSalt)
function hashPasswordWithHexSalt(password, hexSalt) {
  const saltBuffer = Buffer.from(hexSalt, 'hex');
  return crypto.pbkdf2Sync(password, saltBuffer, 1000, 64, 'sha512').toString('hex');
}

exports.register = async (req, res) => {
  // Support multipart fields possibly coming as strings
  const body = req.body || {};
  const phone = body.phone || body.mobile;
  const name = body.name;
  const email = body.email;
  const business_vertical = body.business_vertical;
  const address = body.address;
  const state_id = body.state_id ? Number(body.state_id) : null;
  const city_id = body.city_id ? Number(body.city_id) : null;
  const aadhaar_number = body.aadhaar_number || null;
  const pan_number = body.pan_number || null;
  const company_name = body.company_name || null;
  const pin_number = body.pin_number || null;

  if (!phone || !name || !email || !business_vertical) {
    logger.warn('Registration validation failed: missing required fields');
    return res.status(400).json({ message: 'phone, name, email, and business_vertical are required' });
  }

  try {
    // Conflict checks
    const [phoneExists, emailExists] = await Promise.all([
      authRepo.existsBuyerByPhone(phone),
      authRepo.existsBuyerByEmail(email)
    ]);
    if (phoneExists) {
      return res.status(409).json({ message: 'Phone already registered' });
    }
    if (emailExists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const safeBusinessVertical = business_vertical ?? null; // 'I' | 'B' | 'A'
    const safeAddress = address ?? null;
    const safeStateId = state_id ?? null;
    const safeCityId = city_id ?? null;
    const safeAadhaar = aadhaar_number ?? null;
    const safePan = pan_number ?? null;
    const safeCompany = company_name ?? null;
    const safePincode = pin_number ?? null;

    // Step 1: create buyer and get id
    const { insertId: buyerId } = await authRepo.createBuyer(
      name,
      email,
      phone,
      safeBusinessVertical,
      safeAddress,
      safeStateId,
      safeCityId,
      safeAadhaar,
      safePan,
      safeCompany,
      safePincode
    );

    logger.info(`Buyer registered with phone ${phone} and id ${buyerId}`);
    res.status(201).json({ message: 'Buyer registered', id: buyerId });
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

    const passwordStr = String(password);
    const saltStr = String(user.salt).trim();

    // Normalize stored password: it could be string or Buffer
    let storedPassword = user.password;
    if (Buffer.isBuffer(storedPassword)) {
      // Try utf8 (text hex) first; if not matching later, we'll also try hex view
      storedPassword = storedPassword.toString('utf8');
    }

    const hashed = hashPassword(passwordStr, saltStr);
    const legacyHashed = hashPasswordWithHexSalt(passwordStr, saltStr);

    // Optionally derive hex view if DB returned binary
    let storedHexView;
    if (Buffer.isBuffer(user.password)) {
      storedHexView = user.password.toString('hex');
    }

    const isMatch = (hashed === storedPassword) || (legacyHashed === storedPassword) ||
      (storedHexView ? (hashed === storedHexView || legacyHashed === storedHexView) : false);

    logger.info(`Buyer login compare: pwdType=${typeof password} storedType=${Buffer.isBuffer(user.password) ? 'buffer' : typeof user.password} storedLen=${String(storedPassword).length}${storedHexView ? ` storedHexLen=${storedHexView.length}` : ''} hashLen=${hashed.length}`);
    logger.info(`Buyer login digests: stored=${String(storedPassword).slice(0,12)} hashed=${hashed.slice(0,12)} legacy=${legacyHashed.slice(0,12)}${storedHexView ? ` storedHex=${storedHexView.slice(0,12)}` : ''}`);

    if (!isMatch) {
      logger.warn(`Login failed: Incorrect password for phone ${phone}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, userType: 'buyer', phoneNo: user.mobile });
    const refreshToken = generateRefreshToken({ id: user.id, userType: 'buyer', phoneNo: user.mobile });
    logger.info(`Login successful for phone: ${phone}`);
    res.json({ token, refreshToken });
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

// Forgot Password: generate 8-char lowercase password, hash+salt, update, email
exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  try {
    const user = await authRepo.getBuyerByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    // Generate new password: 8 lowercase letters
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      const idx = crypto.randomInt(0, alphabet.length);
      newPassword += alphabet[idx];
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPwd = hashPassword(newPassword, salt);

    await authRepo.updateBuyerPasswordByEmail(email, hashedPwd, salt);

    const transport = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "8bb189315df133",
        pass: "1b4cbdb05de3b8"
      }
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset</title>
  <style>
    :root { --primary: #67c151; }
    body { margin:0; background:#f5f7fa; font-family:Arial, Helvetica, sans-serif; color:#1f2937; }
    .container { width:100%; padding:24px; }
    .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,0.06); overflow:hidden; }
    .header { background:var(--primary); color:#fff; padding:20px 24px; }
    .brand { font-size:20px; font-weight:700; letter-spacing:0.3px; }
    .content { padding:24px; }
    h1 { font-size:22px; margin:0 0 12px; }
    p { margin:0 0 12px; line-height:1.6; }
    .password-box { margin:16px 0; background:#f0fdf4; border:1px dashed #86efac; color:#065f46; padding:14px 16px; border-radius:10px; font-weight:700; letter-spacing:2px; text-align:center; font-size:18px; }
    .btn { display:inline-block; margin-top:12px; padding:12px 18px; background:var(--primary); color:#fff !important; text-decoration:none; border-radius:8px; font-weight:700; margin:0 auto;}
    .footer { padding:16px 24px; background:#fafafa; font-size:12px; color:#6b7280; text-align:center; }
    @media (max-width:600px){ .content{ padding:18px; } .header{ padding:18px; } }
  </style>
  <!--[if mso]>
    <style>
      .password-box { letter-spacing: 1px !important; }
    </style>
  <![endif]-->
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <div class="brand">KMSG</div>
        </div>
        <div class="content">
          <h1>Password reset successful</h1>
          <p>Hi ${user.name || ''},</p>
          <p>Your password has been reset. Use the password below to sign in. For your security, please change it after logging in.</p>
          <div class="password-box">${newPassword}</div>
          <p>If you did not request this change, please contact support immediately.</p>
          <a class="btn" href="https://kmsg.app" target="_blank" rel="noreferrer">Open App</a>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} KMSG. All rights reserved.</div>
      </div>
    </div>
  </body>
</html>`;

    await transport.sendMail({
      from: 'KMSG <no-reply@kmsg.app>',
      to: email,
      subject: 'Your KMSG password has been reset',
      html
    });

    logger.info(`Password reset email sent to ${email}`);
    res.json({ message: 'A new password has been sent to your email' });
  } catch (err) {
    logger.error(`Forgot password failed for ${email}: ${err.message}`);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};