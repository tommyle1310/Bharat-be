const express = require('express');
const router = express.Router();
const sellerAuthController = require('../controllers/seller-auth.controller');

router.post('/register', sellerAuthController.register);
router.post('/login', sellerAuthController.login);
router.post('/logout', sellerAuthController.logout);
router.get('/verify', sellerAuthController.verify);
module.exports = router;
