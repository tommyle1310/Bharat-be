// index.js
// common-auth/index.js
const path = require('path');
require('dotenv-flow').config({
  path: path.resolve(__dirname, '../../') // 👈 this points to root where your .env exists
});

const PORT = process.env.AUTH_PORT;

const cors = require('cors')
const express = require('express');
const app = express();

const companyAuthRoutes = require('./routes/company-auth.routes')
const buyerAuthRoutes = require('./routes/buyer-auth.routes'); // ✅
const sellerAuthRoutes = require('./routes/seller-auth.routes'); // ✅
const logger = require('../../shared/utils/logger/logger');


app.use(cors({
  // origin: '*',  // Replace with your actual frontend domain
  origin: ['http://localhost:3000','http://13.203.1.159:3000',
    'http://localhost:1311','http://13.203.1.159:1311' // buyer
  ],  // Replace with your actual frontend domain
  credentials: true 
}));
app.use(express.json());
// Mount all auth routes under `/`
app.use('/company', companyAuthRoutes); // ✅ e.g., POST /register, /login, /logout, /verify
app.use('/buyer', buyerAuthRoutes); // ✅ e.g., POST /register, /login, /logout, /verify
app.use('/seller', sellerAuthRoutes); // ✅ e.g., POST /register, /login, /logout, /verify

app.listen(PORT, () => {
  logger.info(`auth running on port ${PORT}`);
});

