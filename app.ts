import express, { Application, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config/config';
import { checkRedisHealth } from './config/redis';
import vehicleRoutes from './modules/vehicles/vehicle.routes';
import makeRoutes from './modules/vehicle_makes/make.routes';
import modelRoutes from './modules/vehicle_models/model.routes';
import variantRoutes from './modules/vehicle_variants/variant.routes';
import fuelRoutes from './modules/fuel_types/fuel.routes';
import imageRoutes from './modules/vehicle_images/image.routes';
import caseOptionRoutes from './modules/case_options/case.routes';
import stateRoutes from './modules/states/state.routes';
import cityRoutes from './modules/cities/city.routes';
import staffRoutes from './modules/staffs/staff.routes';
import buyerRoutes from './modules/buyers/buyer.routes';
import buyerBidRoutes from './modules/buyer_bids/buyer_bids.routes';
import watchlistRoutes from './modules/watchlist/watchlist.routes';
import autoBidRoutes from './modules/auto_bid/auto_bid.routes';
import wishlistRoutes from './modules/wishlist/wishlist.routes';
import winRoutes from './modules/win/win.routes';
import buyerAccessRoutes from './modules/buyer_access/buyer_access.routes';
import sellerRoutes from './modules/seller/seller.routes';
import { API_PREFIX } from './types/app';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  // Robust CORS: dynamic allowlist + preflight support
  const allowAllOrigins = config.corsOrigin.includes('*');
  const allowedOrigins = new Set([
    ...config.corsOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    'https://localhost:3000',
  ]);
  console.log('[CORS] Allowed origins:', allowAllOrigins ? ['<ALL>'] : Array.from(allowedOrigins));
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (allowAllOrigins) return callback(null, true);
      if (!origin) return callback(null, true); // non-browser or same-origin
      if (
        allowedOrigins.has(origin) ||
        origin === 'http://localhost:3000' ||
        origin === 'http://13.203.1.159:1311'
      ) {
        return callback(null, true);
      }
      // Don't error the request; just omit CORS headers
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));
  // Use regex for Express v5 router compatibility (avoid literal '*')
  app.options(/.*/, cors(corsOptions));
  app.use(morgan('dev'));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static files
  // Local public directory (backend-specific static files)
  // Accessible via: http://localhost:1310/public/filename.ext
  app.use(config.static.publicUrl, express.static(config.static.publicPath));
  
  // External data-files directory (sibling to backend)
  // Accessible via: http://localhost:1310/data-files/filename.ext
  // This serves files from kmsg/data-files/ directory
  app.use(config.static.dataFilesUrl, (req: Request, res: Response, next: NextFunction) => {
    const filePath = path.join(config.static.dataFilesPath, req.path);
    
    console.log(`[Static Files] Requested: ${req.path}`);
    console.log(`[Static Files] Full path: ${filePath}`);
    console.log(`[Static Files] File exists: ${fs.existsSync(filePath)}`);
  
    if (fs.existsSync(filePath)) {
      console.log(`[Static Files] Serving file: ${filePath}`);
      return res.sendFile(filePath);
    }
  
    console.log(`[Static Files] File not found, serving fallback: ${req.path}`);
    // Nếu file không tồn tại → trả fallback image
    const fallbackPath = path.join(__dirname, '../public/no-image.jpg');
    return res.sendFile(fallbackPath, err => {
      if (err) {
        console.error("Fallback image not found!", err);
        res.status(404).json({ message: "Image not found" });
      }
    });
  });
  

  // Health
  app.get('/health', async (_req: Request, res: Response) => {
    const redisOk = await checkRedisHealth();
    res.json({ status: 'ok', redis: redisOk ? 'up' : 'down' });
  });

  // Root info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'KMSG Buyer Service',
      health: '/health',
      apiBase: `/${API_PREFIX}`,
    });
  });

  // API routes
  app.use(`/${API_PREFIX}/vehicles`, vehicleRoutes);
  app.use(`/${API_PREFIX}/sellers`, sellerRoutes);
  app.use(`/${API_PREFIX}/vehicle-makes`, makeRoutes);
  app.use(`/${API_PREFIX}/vehicle-models`, modelRoutes);
  app.use(`/${API_PREFIX}/vehicle-variants`, variantRoutes);
  app.use(`/${API_PREFIX}/fuel-types`, fuelRoutes);
  app.use(`/${API_PREFIX}/vehicle-images`, imageRoutes);
  app.use(`/${API_PREFIX}/case-options`, caseOptionRoutes);
  app.use(`/${API_PREFIX}/states`, stateRoutes);
  app.use(`/${API_PREFIX}/cities`, cityRoutes);
  app.use(`/${API_PREFIX}/staffs`, staffRoutes);
  app.use(`/${API_PREFIX}/buyers`, buyerRoutes);
  app.use(`/${API_PREFIX}/buyer-bids`, buyerBidRoutes);
  app.use(`/${API_PREFIX}/watchlist`, watchlistRoutes);
  app.use(`/${API_PREFIX}/auto-bid`, autoBidRoutes);
  app.use(`/${API_PREFIX}/wishlist`, wishlistRoutes);
  app.use(`/${API_PREFIX}/win`, winRoutes);
  app.use(`/${API_PREFIX}/buyer-access`, buyerAccessRoutes);
  // app.use(`/${API_PREFIX}/vehicle-types`, vehicleTypeRoutes);
  // app.use(`/${API_PREFIX}/ownership-serials`, ownershipSerialRoutes);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
  });

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });

  return app;
}
