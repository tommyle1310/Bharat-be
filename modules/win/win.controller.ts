import { Request, Response } from 'express';
import * as service from './win.service';
import { sendSuccess, sendValidationError } from '../../utils/response';
import { AuctionStatus } from './win.dao';

export async function getWinningVehicles(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const keyword = req.query.keyword as string;
  
  // Extract and validate auction_status_id parameter
  const auctionStatusIdParam = req.query.auction_status_id as string;
  let auctionStatusId: number | undefined;
  
  if (auctionStatusIdParam) {
    const statusNum = Number(auctionStatusIdParam);
    if (![20, 30, 70, 100, 120, 140].includes(statusNum)) {
      return sendValidationError(res, 'Invalid auction_status_id. Must be one of: 20, 30, 70, 100, 120, 140');
    }
    auctionStatusId = statusNum;
  }
  
  // Extract and validate auction_status parameter
  const auctionStatusParam = req.query.auction_status as string;
  let auctionStatus: AuctionStatus | undefined;
  
  if (auctionStatusParam) {
    if (!Object.values(AuctionStatus).includes(auctionStatusParam as AuctionStatus)) {
      return sendValidationError(res, 'Invalid auction_status. Must be one of: APPROVAL_PENDING, APPROVED, PAYMENT_PENDING, COMPLETED');
    }
    auctionStatus = auctionStatusParam as AuctionStatus;
  }
  
  // Ensure only one auction status filter is provided
  if (auctionStatusId && auctionStatus) {
    return sendValidationError(res, 'Cannot specify both auction_status_id and auction_status parameters');
  }
  
  if (!buyerId) return sendValidationError(res, 'Invalid buyer');
  
  const items = await service.getWinningVehicles(buyerId, businessVertical, page, pageSize, keyword, auctionStatusId, auctionStatus);
  return sendSuccess(res, 'Winning vehicles retrieved successfully', items);
}
