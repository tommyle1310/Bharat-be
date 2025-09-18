import { Request, Response } from 'express';
import * as service from './watchlist.service';
import { sendSuccess, sendError, sendNoContent, sendValidationError } from '../../utils/response';

export async function add(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.body.vehicle_id || req.params.vehicleId);
  if (!buyerId || Number.isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid buyer or vehicle id');
  }
  await service.add(buyerId, vehicleId);
  return sendNoContent(res, 'Vehicle added to watchlist successfully');
}

export async function list(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const keyword = req.query.keyword as string;
  if (!buyerId) {
    return sendValidationError(res, 'Invalid buyer');
  }
  const items = await service.list(buyerId, page, pageSize, keyword);
  return sendSuccess(res, 'Watchlist retrieved successfully', items);
}

export async function toggle(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.body.vehicle_id || req.params.vehicleId);
  if (!buyerId || Number.isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid buyer or vehicle id');
  }
  const result = await service.toggle(buyerId, vehicleId);
  return sendSuccess(res, 'Watchlist toggle completed successfully', result);
}


