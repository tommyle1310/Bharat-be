import { Router } from 'express';
import * as ctrl from './buyer_bids.controller';

const router = Router();

router.get('/history/:buyerId', ctrl.history);
router.get('/history-by-vehicle/:buyerId/:vehicleId', ctrl.historyByVehicle);
router.get('/limits/:buyerId', ctrl.getBuyerLimits);
router.post('/manual', ctrl.manualBid);

export default router;


