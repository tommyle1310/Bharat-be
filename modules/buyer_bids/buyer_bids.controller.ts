import { Request, Response } from 'express';
import * as dao from './buyer_bids.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';
import { getRedis } from '../../config/redis';
import { getIO } from '../../config/socket';
import { checkBuyerAccess } from '../buyer_access/buyer_access.dao';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendValidationError, sendBusinessError, sendInternalError } from '../../utils/response';

function parseMySqlIst(ts?: unknown): Date | null {
  if (ts == null) return null;
  if (ts instanceof Date && !isNaN(ts.getTime())) return ts;
  const s = String(ts);
  if (!s) return null;
  // expected format: YYYY-MM-DD HH:mm:ss in IST, but be defensive
  const parts = s.split(' ');
  const datePart = parts[0];
  const timePart = parts[1];
  if (!datePart || !timePart) return null;
  const dateSegs = datePart.split('-');
  const timeSegs = timePart.split(':');
  const y = Number(dateSegs?.[0] ?? 0);
  const m = Number(dateSegs?.[1] ?? 1);
  const d = Number(dateSegs?.[2] ?? 1);
  const hh = Number(timeSegs?.[0] ?? 0);
  const mm = Number(timeSegs?.[1] ?? 0);
  const ss = Number(timeSegs?.[2] ?? 0);
  // Convert IST -> UTC by subtracting 5h30m
  const utcMs = Date.UTC(y, m - 1, d, hh - 5, mm - 30, ss);
  return new Date(utcMs);
}

function formatToMySqlIst(dateUtc: Date): string {
  // Convert UTC -> IST by adding 5h30m, then format as YYYY-MM-DD HH:mm:ss
  const ist = new Date(dateUtc.getTime() + 330 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = ist.getUTCFullYear();
  const mo = pad(ist.getUTCMonth() + 1);
  const d = pad(ist.getUTCDate());
  const h = pad(ist.getUTCHours());
  const mi = pad(ist.getUTCMinutes());
  const s = pad(ist.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

export async function history(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  if (Number.isNaN(buyerId)) return sendValidationError(res, 'Invalid buyerId');
  const rows = await dao.getBuyerBidHistory(buyerId, page, pageSize);
  return sendSuccess(res, 'Bid history retrieved successfully', rows);
}

export async function historyByVehicle(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  const vehicleId = Number(req.params.vehicleId);
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  if (Number.isNaN(buyerId) || Number.isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid buyerId or vehicleId');
  }
  const rows = await dao.getBuyerBidHistoryByVehicle(buyerId, vehicleId, page, pageSize);
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

  // Enforce auction end and handle near-end extension (<= 5 minutes) in DB (IST-aware)
  let payloadAuctionEnd: string | null | undefined = undefined;
  try {
    const { getDb } = await import('../../config/database');
    const db = getDb();
    // 1) Hard stop if time is up
    const [endCheckRows] = await db.query<any[]>(
      `SELECT auction_end_dttm, final_expiry_dttm, (auction_end_dttm <= NOW()) AS ended
       FROM vehicles WHERE vehicle_id = ?`,
      [vehicleId]
    );
    const ended = Boolean(endCheckRows?.[0]?.ended);
    console.log('[manualBid][TIME][DB] vehicle_id=', vehicleId, 'auction_end_dttm=', endCheckRows?.[0]?.auction_end_dttm, 'final_expiry_dttm=', endCheckRows?.[0]?.final_expiry_dttm, 'ended=', ended);
    if (ended) {
      return sendBusinessError(res, 'Time is up');
    }
    // 2) If within last 5 minutes, extend by min(final-expiry delta, 5 minutes)
    const [updateResult] = await db.query<any>(
      `UPDATE vehicles
       SET auction_end_dttm = CASE
         WHEN TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) > 0
          AND TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) <= 300
         THEN DATE_ADD(auction_end_dttm, INTERVAL LEAST(GREATEST(TIMESTAMPDIFF(SECOND, auction_end_dttm, final_expiry_dttm), 0), 300) SECOND)
         ELSE auction_end_dttm
       END
       WHERE vehicle_id = ?`,
      [vehicleId]
    );
    console.log('[manualBid][EXTEND][DB] UPDATE vehicles affectedRows=', updateResult?.affectedRows);
    // 3) Re-read to emit the possibly-updated value
    const [afterRows] = await db.query<any[]>(`SELECT auction_end_dttm FROM vehicles WHERE vehicle_id = ?`, [vehicleId]);
    const newAuctionEnd = afterRows?.[0]?.auction_end_dttm ?? (vehicle as any).auction_end_dttm;
    (vehicle as any).auction_end_dttm = newAuctionEnd;
    // Decide payload auctionEndDttm: if no change, explicitly null; if changed, use new value
    const changed = String(newAuctionEnd) !== String(endCheckRows?.[0]?.auction_end_dttm);
    payloadAuctionEnd = changed ? String(newAuctionEnd) : null;
    // Only emit if it changed within window
    const io = getIO();
    io.emit('vehicle:endtime:update', { vehicleId, auctionEndDttm: newAuctionEnd });
    console.log('[manualBid][EXTEND][DB] Emitted vehicle:endtime:update auctionEndDttm=', newAuctionEnd);
  } catch (e) {
    console.error('[manualBid][EXTEND][DB] Error handling extension in DB', e);
  }

  // Check buyer access first
  try {
    const accessCheck = await checkBuyerAccess(buyerId, vehicleId);
    if (!accessCheck.hasAccess) {
      const firstReason = accessCheck.missingAccess[0] || "You don't have access to place bid on this vehicle";
      return sendForbidden(res, firstReason);
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
  }, payloadAuctionEnd);

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
      const auctionEndDttm = (vehicle as any).auction_end_dttm as any;
      const winnerPayload = {
        vehicleId: vehicleId,
        winnerBuyerId: buyerId,
        loserBuyerId: previousTopBuyerId && previousTopBuyerId !== buyerId ? previousTopBuyerId : null,
        auctionEndDttm,
      };
      await redis.publish('vehicle:winner:update', JSON.stringify(winnerPayload));
    } catch (e) {
      console.error('[manualBid] Failed to publish vehicle:winner:update', e);
    }

    // Direct emits for immediate UX (targeted rooms by buyerId)
    try {
      const io = getIO();
      io.to(String(buyerId)).emit('isWinning', { vehicleId, auctionEndDttm: (vehicle as any).auction_end_dttm });
      if (previousTopBuyerId && previousTopBuyerId !== buyerId) {
        io.to(String(previousTopBuyerId)).emit('isLosing', { vehicleId, auctionEndDttm: (vehicle as any).auction_end_dttm });
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
 * - bid_limit: 
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


export async function requestCancel(req: Request, res: Response) {
  try {
    const buyerId = Number(req.buyer?.id);
    const bidId = Number(req.body?.bidId ?? req.params?.bidId);
    if (!buyerId || Number.isNaN(buyerId)) {
      return sendForbidden(res, 'Unauthorized');
    }
    if (!bidId || Number.isNaN(bidId)) {
      return sendValidationError(res, 'Invalid bidId');
    }

    const { vehicleId } = await dao.requestCancelBid(bidId, buyerId);

    try {
      const redis = getRedis();
      const payload = { vehicleId, buyerId, bidId };
      await redis.publish('vehicle:bid:cancel', JSON.stringify(payload));
    } catch (e) {
      console.error('[requestCancel] Failed to publish vehicle:bid:cancel', e);
    }

    return sendSuccess(res, 'Cancellation requested', { vehicleId, buyerId, bidId });
  } catch (err) {
    if (err instanceof Error && err.message === 'Bid not found') {
      return sendNotFound(res, 'Bid not found');
    }
    return sendInternalError(res, 'Failed to request cancellation');
  }
}

