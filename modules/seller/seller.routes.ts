
import { Router } from 'express';
import * as ctrl from './seller.controller';

const router = Router();

router.get('/search', ctrl.searchSellers);
router.get('/:sellerId', ctrl.getSellerById);
router.get('/', ctrl.getAllSellers);

export default router;


