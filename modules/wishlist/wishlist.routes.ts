import { Router } from 'express';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';
import * as ctrl from './wishlist.controller';

const router = Router();

router.get('/configuration', requireBuyerAuth, ctrl.getConfiguration);
router.get('/search', requireBuyerAuth, ctrl.list);
router.get('/', requireBuyerAuth, ctrl.list);
router.get('/:businessVertical', requireBuyerAuth, ctrl.list);
router.get('/:businessVertical/search', requireBuyerAuth, ctrl.list);
router.post('/update-wishlist', requireBuyerAuth, ctrl.updatePreferences);

export default router;


