import { Request, Response } from 'express';
import * as service from './win.service';
import { sendSuccess, sendValidationError } from '../../utils/response';

export async function getWinningVehicles(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const keyword = req.query.keyword as string;
  
  if (!buyerId) return sendValidationError(res, 'Invalid buyer');
  
  const items = await service.getWinningVehicles(buyerId, businessVertical, page, pageSize, keyword);
  return sendSuccess(res, 'Winning vehicles retrieved successfully', items);
}
