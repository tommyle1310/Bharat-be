import { Router } from 'express';
import * as ctrl from './vehicle.controller';

const router = Router();

// Specific routes first to avoid being captured by ":id"
router.get('/groups/list', ctrl.listByGroup);
router.get('/groups', ctrl.groups);
router.get('/search', ctrl.search);
router.get('/search-by-group', ctrl.searchByGroup);
router.get('/filter-by-group', ctrl.filterByGroup);
router.get('/lookup/ownership', ctrl.getOwnershipTypes);
router.get('/lookup/fuel', ctrl.getFuelTypes);
router.get('/lookup/vehicle-types', ctrl.getVehicleTypes);
router.get('/lookup/vehicle-images', ctrl.getSelectedVehicleImages);

// Standard CRUD
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;


