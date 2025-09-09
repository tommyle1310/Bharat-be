import express, { Application, Request, Response, NextFunction } from 'express';
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
import autoBidRoutes from './modules/auto_bid/auto_bid.routes';
import { API_PREFIX } from './types/app';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
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
  app.use(config.static.dataFilesUrl, express.static(config.static.dataFilesPath));

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
  app.use(`/${API_PREFIX}/auto-bid`, autoBidRoutes);
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
