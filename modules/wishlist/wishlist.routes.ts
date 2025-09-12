import { Router } from 'express';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';
import * as ctrl from './wishlist.controller';

const router = Router();

router.get('/', requireBuyerAuth, ctrl.list);
router.get('/:businessVertical', requireBuyerAuth, ctrl.list);

export default router;


