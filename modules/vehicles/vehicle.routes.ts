import { Router } from 'express';
import * as ctrl from './vehicle.controller';
import { requireBuyerAuth } from '../../middlewares/auth.middleware';

const router = Router();

// Specific routes first to avoid being captured by ":id"
router.get('/groups/list', requireBuyerAuth, ctrl.listByGroup);
router.get('/groups', ctrl.groups);
router.get('/search', requireBuyerAuth, ctrl.search);
router.get('/search-by-group', requireBuyerAuth, ctrl.searchByGroup);
router.get('/filter-by-group', requireBuyerAuth, ctrl.filterByGroup);
router.get('/filter', requireBuyerAuth, ctrl.filterAll);
// businessVertical-aware routes (A|B|I) as path param; keep backward compatible above
router.get('/:businessVertical/groups/list', requireBuyerAuth, ctrl.listByGroup);
router.get('/:businessVertical/search-by-group', requireBuyerAuth, ctrl.searchByGroup);
router.get('/:businessVertical/filter-by-group', requireBuyerAuth, ctrl.filterByGroup);
router.get('/:businessVertical/filter', requireBuyerAuth, ctrl.filterAll);
router.get('/lookup/ownership', ctrl.getOwnershipTypes);
router.get('/lookup/fuel', ctrl.getFuelTypes);
router.get('/lookup/vehicle-types', ctrl.getVehicleTypes);
router.get('/lookup/vehicle-subcategories', ctrl.getVehicleSubcategories);
router.get('/lookup/vehicle-images', ctrl.getSelectedVehicleImages);

// Standard CRUD
router.get('/', requireBuyerAuth, ctrl.list);
router.get('/:id', requireBuyerAuth, ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;


