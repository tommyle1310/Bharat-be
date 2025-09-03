import { Router } from 'express';
import * as ctrl from './image.controller';

const router = Router();
router.get('/vehicle/:vehicleId', ctrl.listByVehicle);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);
export default router;


