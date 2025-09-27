import { Router } from 'express';
import * as ctrl from './fuel.controller';

const router = Router();
router.get('/', ctrl.list);
router.put('/', ctrl.upsert);
export default router;


