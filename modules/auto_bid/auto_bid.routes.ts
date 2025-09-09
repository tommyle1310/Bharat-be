import { Router } from 'express';
import * as ctrl from './auto_bid.controller';

const router = Router();

router.post('/set', ctrl.setAutoBid);

export default router;


