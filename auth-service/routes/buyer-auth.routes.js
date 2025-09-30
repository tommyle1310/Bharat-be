const express = require('express');
const router = express.Router();
const multer = require('multer');
const buyerAuthController = require('../controllers/buyer-auth.controller');

// Use memory storage so service can decide final paths and names
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/register',
  buyerAuthController.register
);
router.post('/login', buyerAuthController.login);
router.post('/logout', buyerAuthController.logout);
router.get('/verify', buyerAuthController.verify);
router.post('/refresh', buyerAuthController.refreshToken);
router.post('/forgot-password', buyerAuthController.forgotPassword);


module.exports = router;
