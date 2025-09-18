import { Request, Response } from 'express';
import * as service from './wishlist.service';
import { sendSuccess, sendError, sendInternalError, sendValidationError } from '../../utils/response';

export async function list(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const keyword = req.query.keyword as string;
  if (!buyerId) return sendValidationError(res, 'Invalid buyer');
  // Call service with keyword parameter for search functionality
  const items = await service.list(buyerId, businessVertical, page, pageSize, keyword);
  return sendSuccess(res, 'Wishlist retrieved successfully', items);
}

export async function updatePreferences(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return sendValidationError(res, 'Invalid buyer');

  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';

  const vehicleType = String((req.query.vehicleType || req.query.vehicle_type || '') as string);
  const vehicleFuel = String((req.query.fuel || req.query.vehicle_fuel || '') as string);
  const ownership = String((req.query.ownership || '') as string);
  const rcAvailable = String((req.query.rc_available || '') as string);
  const sellerId = String((req.query.sellerId || req.query.seller_id || '') as string);
  const stateIds = String((req.query.stateIds || req.query.state || '') as string);
  const makeIds = String((req.query.makeIds || req.query.make || '') as string);
  const subcategoryIds = String((req.query.subcategoryIds || req.query.subcategory || '') as string);
  const categoryId = String((req.query.categoryId || '') as string);

  try {
    const result = await service.updatePreferences({
      buyerId,
      businessVertical,
      vehicleType,
      vehicleFuel,
      ownership,
      rcAvailable,
      sellerId,
      stateIds,
      makeIds,
      subcategoryIds,
      categoryId,
    });
    return sendSuccess(res, 'Wishlist preferences updated successfully', { success: true, updated: result });
  } catch (err) {
    console.error('Wishlist update error:', err);
    return sendInternalError(res, 'Failed to update wishlist preferences');
  }
}

export async function getConfiguration(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return sendValidationError(res, 'Invalid buyer');

  try {
    const configuration = await service.getConfiguration(buyerId);
    return sendSuccess(res, 'Wishlist configuration retrieved successfully', { success: true, configuration });
  } catch (err) {
    return sendInternalError(res, 'Failed to get wishlist configuration');
  }
}


