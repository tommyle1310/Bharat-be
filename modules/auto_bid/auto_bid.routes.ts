import { Router } from 'express';
import * as ctrl from './auto_bid.controller';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/set', ctrl.setAutoBid);
router.get('/my-bids', requireBuyerAuth, ctrl.getAutoBidsByBuyer);
router.get('/:vehicleId', requireBuyerAuth, ctrl.getAutoBidData);
router.put('/:vehicleId', requireBuyerAuth, ctrl.updateAutoBid);
router.delete('/:vehicleId', requireBuyerAuth, ctrl.removeAutoBid);

export default router;


