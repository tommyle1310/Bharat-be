const express = require('express');
const router = express.Router();

const companyAuthRoutes = require('./company-auth.routes');
const buyerAuthRoutes = require('./buyer-auth.routes');
const sellerAuthRoutes = require('./seller-auth.routes');

router.use('/buyer', buyerAuthRoutes); // All routes start from /buyer
router.use('/seller', sellerAuthRoutes);
router.use('/company', companyAuthRoutes);

module.exports = router;