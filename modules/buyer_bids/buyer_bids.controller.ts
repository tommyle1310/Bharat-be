import { Request, Response } from 'express';
import * as dao from './buyer_bids.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';
import { getRedis } from '../../config/redis';
import { getIO } from '../../config/socket';
import { checkBuyerAccess } from '../buyer_access/buyer_access.dao';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendValidationError, sendBusinessError, sendInternalError } from '../../utils/response';

export async function history(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  if (Number.isNaN(buyerId)) return sendValidationError(res, 'Invalid buyerId');
  const rows = await dao.getBuyerBidHistory(buyerId);
  return sendSuccess(res, 'Bid history retrieved successfully', rows);
}

export async function historyByVehicle(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  const vehicleId = Number(req.params.vehicleId);
  if (Number.isNaN(buyerId) || Number.isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid buyerId or vehicleId');
  }
  const rows = await dao.getBuyerBidHistoryByVehicle(buyerId, vehicleId);
  return sendSuccess(res, 'Bid history by vehicle retrieved successfully', rows);
}

export async function manualBid(req: Request, res: Response) {
  const { buyer_id, vehicle_id, bid_amount } = req.body || {};
  const buyerId = Number(buyer_id);
  const vehicleId = Number(vehicle_id);
  const bidAmt = Number(bid_amount);
  if ([buyerId, vehicleId, bidAmt].some((v) => Number.isNaN(v))) {
    return sendValidationError(res, 'buyer_id, vehicle_id, bid_amount are required');
  }

  const vehicle = await vehicleDao.getVehicleById(vehicleId);
  if (!vehicle) return sendNotFound(res, 'Vehicle not found');

  // Check buyer access first
  try {
    const accessCheck = await checkBuyerAccess(buyerId, vehicleId);
    if (!accessCheck.hasAccess) {
      const accessTypes = accessCheck.missingAccess.join(', ');
      return sendForbidden(res, `You don't have access to place bid on this vehicle`);
    }
  } catch (accessError) {
    return sendForbidden(res, (accessError as Error).message);
  }

  // Check max price limit
  if (vehicle.max_price != null && bidAmt > Number(vehicle.max_price)) {
    return sendBusinessError(res, 'You bid too high!');
  }

  if (vehicle.base_price != null && bidAmt < Number(vehicle.base_price)) {
    return sendBusinessError(res, 'Bid amount did not reach base price');
  }

  // Check if bid amount exceeds buyer's pending limit
  try {
    const limitInfo = await dao.getBuyerLimitInfo(buyerId);
    if (bidAmt > limitInfo.pending_limit) {
      return sendBusinessError(res, `Max bid amount exceeds your pending limit`);
    }
  } catch (limitError) {
    console.error('[manualBid] Error checking buyer limits:', limitError);
    return sendInternalError(res, 'Failed to validate buyer limits');
  }

  const lastBid = await dao.getLatestBuyerBidForVehicle(buyerId, vehicleId);
  console.log(`Debug: buyerId=${buyerId}, vehicleId=${vehicleId}, lastBid=${lastBid}, bidAmt=${bidAmt}`);
  if (lastBid != null) {
    if (bidAmt <= lastBid) {
      return sendBusinessError(res, 'Bid must be higher than previous bid');
    }
    const bidDifference = bidAmt - lastBid;
    console.log(`Debug: bidDifference=${bidDifference}`);
    if (bidDifference < 1000) {
      return sendBusinessError(res, 'Bid difference must be at least 1000');
    }
  }

  // Get current top bid for this vehicle
  const currentTopBid = await dao.getTopBidForVehicle(vehicleId);
  const currentTopBidAmount = currentTopBid?.amount ?? 0;
  const previousTopBuyerId = currentTopBid?.buyer_id ?? null;
  
  // Determine if this bid becomes the new top bid
  const isTopBid = bidAmt > currentTopBidAmount;
  const topBidAtInsert = isTopBid ? 1 : 0;

  await dao.insertBuyerBid({
    vehicle_id: vehicleId,
    buyer_id: buyerId,
    bid_amt: bidAmt,
    is_surrogate: 0,
    bid_mode: 'M',
    top_bid_at_insert: topBidAtInsert,
    user_id: 0,
  });

  // Update vehicle table with bidders_count and top_bidder_id
  const { updateVehicleBidderInfo } = await import('../vehicles/vehicle.dao');
  // Get the current top bidder after the bid was placed
  const currentTopBidAfterBid = await dao.getTopBidForVehicle(vehicleId);
  const topBidderId = currentTopBidAfterBid ? currentTopBidAfterBid.buyer_id : null;
  await updateVehicleBidderInfo(vehicleId, topBidderId);
  
  // Update other buyer bids to set top_bid_at_insert to 0 if this is the new top bid
  if (isTopBid) {
    await dao.updateOtherBuyerBidsTopBidStatus(vehicleId, buyerId);

    // Publish winner update so server can forward via Socket.IO
    try {
      const redis = getRedis();
      const winnerPayload = {
        vehicleId: vehicleId,
        winnerBuyerId: buyerId,
        loserBuyerId: previousTopBuyerId && previousTopBuyerId !== buyerId ? previousTopBuyerId : null,
      };
      await redis.publish('vehicle:winner:update', JSON.stringify(winnerPayload));
    } catch (e) {
      console.error('[manualBid] Failed to publish vehicle:winner:update', e);
    }

    // Direct emits for immediate UX (targeted rooms by buyerId)
    try {
      const io = getIO();
      io.to(String(buyerId)).emit('isWinning', { vehicleId });
      if (previousTopBuyerId && previousTopBuyerId !== buyerId) {
        io.to(String(previousTopBuyerId)).emit('isLosing', { vehicleId });
      }
    } catch (e) {
      console.error('[manualBid] Failed to emit isWinning/isLosing via Socket.IO', e);
    }
  }

  return sendSuccess(res, 'Bid placed successfully', { vehicleId, buyerId, bidAmt });
}

/**
 * Get buyer's bidding limits and current usage
 * 
 * Calculates:
 * - security_deposit: Buyer's security deposit amount
 * - bid_limit: 10x the security deposit
 * - active_vehicle_bids: Current bids on vehicles under auction (status 10)
 * - unpaid_vehicles: Vehicles where buyer is top bidder with pending status (20,30,50,70)
 * - limit_used: Sum of active bids + unpaid amounts
 * - pending_limit: Remaining available limit (bid_limit - limit_used)
 * 
 * @param req - Express request with buyerId in params
 * @param res - Express response
 */
export async function getBuyerLimits(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  if (Number.isNaN(buyerId)) {
    return sendValidationError(res, 'Invalid buyerId');
  }

  try {
    const limitInfo = await dao.getBuyerLimitInfo(buyerId);
    return sendSuccess(res, 'Buyer limits retrieved successfully', limitInfo);
  } catch (error) {
    console.error('[getBuyerLimits] Error:', error);
    if (error instanceof Error && error.message === 'Buyer not found') {
      return sendNotFound(res, 'Buyer not found');
    }
    return sendInternalError(res, 'Failed to retrieve buyer limits');
  }
}


