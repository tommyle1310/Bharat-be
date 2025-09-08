const express = require('express');
const router = express.Router();
const buyerAuthController = require('../controllers/buyer-auth.controller');

router.post('/register', buyerAuthController.register);
router.post('/login', buyerAuthController.login);
router.post('/logout', buyerAuthController.logout);
router.get('/verify', buyerAuthController.verify);


module.exports = router;
