import { Router } from 'express';
import * as ctrl from './buyer_bids.controller';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/history/:buyerId', ctrl.history);
router.get('/history-by-vehicle/:buyerId/:vehicleId', ctrl.historyByVehicle);
router.get('/limits/:buyerId', ctrl.getBuyerLimits);
router.post('/manual', ctrl.manualBid);
router.post('/cancel', requireBuyerAuth, ctrl.requestCancel);

export default router;


