import { Router } from 'express';
import * as ctrl from './buyer_access.controller';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';

const router = Router();

// Check if buyer has access to bid on a specific vehicle
router.get('/check/:vehicleId', requireBuyerAuth, ctrl.checkAccess);

// Seed access data for testing
router.post('/seed', requireBuyerAuth, ctrl.seedAccess);

// Get buyer's access summary
router.get('/summary', requireBuyerAuth, ctrl.getAccessSummary);

export default router;
