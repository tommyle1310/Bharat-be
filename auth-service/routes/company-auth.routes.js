const express = require('express');
const router = express.Router();
const companyAuthController = require('../controllers/company-auth.controller');

router.post('/login', companyAuthController.login);
router.post('/logout', companyAuthController.logout);
router.get('/verify', companyAuthController.verify);
router.post('/refresh', companyAuthController.refreshToken);


module.exports = router;
