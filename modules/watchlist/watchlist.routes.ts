import { Router } from 'express';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';
import * as ctrl from './watchlist.controller';

const router = Router();

// Toggle favorite (add/remove). If already bidded, will lock to favorite (no removal)
router.post('/toggle', requireBuyerAuth, ctrl.toggle);
router.post('/:vehicleId/toggle', requireBuyerAuth, ctrl.toggle);
router.get('/', requireBuyerAuth, ctrl.list);
router.get('/search', requireBuyerAuth, ctrl.list);

export default router;


