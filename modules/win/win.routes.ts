import { Router } from 'express';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';
import * as ctrl from './win.controller';

const router = Router();

router.get('/search', requireBuyerAuth, ctrl.getWinningVehicles);
router.get('/', requireBuyerAuth, ctrl.getWinningVehicles);
router.get('/:businessVertical', requireBuyerAuth, ctrl.getWinningVehicles);
router.get('/:businessVertical/search', requireBuyerAuth, ctrl.getWinningVehicles);

export default router;
