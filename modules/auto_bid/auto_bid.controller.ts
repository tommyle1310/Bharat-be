import { Request, Response } from 'express';
import * as dao from './auto_bid.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';
import { checkBuyerAccess } from '../buyer_access/buyer_access.dao';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendUnauthorized, sendInternalError, sendValidationError, sendBusinessError } from '../../utils/response';

export async function setAutoBid(req: Request, res: Response) {
  const { buyer_id, vehicle_id, start_amount, max_bid, step_amount } = req.body || {};
  const buyerId = Number(buyer_id);
  const vehicleId = Number(vehicle_id);
  const startAmt = Number(start_amount);
  const maxBid = Number(max_bid);
  const stepAmt = Number(step_amount);
  try {
    const accessCheck = await checkBuyerAccess(buyerId, vehicleId);
    if (!accessCheck.hasAccess) {
      const accessTypes = accessCheck.missingAccess.join(', ');
      return sendForbidden(res, `You don't have access to set auto-bid on this vehicle`);
    }
  } catch (accessError) {
    return sendForbidden(res, (accessError as Error).message);
  }
  console.log('check set autobid', buyerId, vehicleId, startAmt, maxBid, stepAmt);
  if ([buyerId, vehicleId, startAmt, maxBid, stepAmt].some((v) => Number.isNaN(v))) {
    return sendValidationError(res, 'buyer_id, vehicle_id, start_amount, max_bid, step_amount required');
  }

  // Enforce minimum bid difference
  if (maxBid - startAmt < 1000) {
    return sendBusinessError(res, 'Bid difference must be at least 1000');
  }

  const vehicle = await vehicleDao.getVehicleById(vehicleId);
  if (!vehicle) return sendNotFound(res, 'Vehicle not found');
  
  // Validate start amount against vehicle base price
  if (vehicle.base_price != null && startAmt < Number(vehicle.base_price)) {
    return sendBusinessError(res, 'Start amount did not reach base price');
  }
  
  // Validate max bid against vehicle max price
  if (vehicle.max_price != null && maxBid > Number(vehicle.max_price)) {
    return sendBusinessError(res, 'Max bid amount exceeds vehicle maximum price');
  }
  
  // Validate step amount - must be at least 1000
  if (stepAmt < 1000) {
    return sendBusinessError(res, 'Step amount must be at least 1000');
  }

  await dao.upsertAutoBid({
    buyer_id: buyerId,
    vehicle_id: vehicleId,
    bid_start_amt: startAmt,
    step_amt: stepAmt,
    max_bid_amt: maxBid,
    max_steps: Math.ceil((maxBid - startAmt) / Math.max(stepAmt, 1)),
    pending_steps: Math.ceil((maxBid - startAmt) / Math.max(stepAmt, 1)),
    last_bid_amt: startAmt,
  });

  return sendSuccess(res, 'Auto bid configured successfully', { buyerId, vehicleId, startAmt, maxBid, stepAmt });
}

export async function getAutoBidsByBuyer(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) {
    return sendUnauthorized(res, 'Buyer authentication required');
  }

  try {
    const autoBids = await dao.getAutoBidsByBuyer(buyerId);
    return sendSuccess(res, 'Auto bids retrieved successfully', autoBids);
  } catch (error) {
    console.error('Error fetching auto bids for buyer:', error);
    return sendInternalError(res, 'Internal server error');
  }
}

export async function getAutoBidData(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);

  if (!buyerId) {
    return sendUnauthorized(res, 'Buyer authentication required');
  }

  if (isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid vehicle ID');
  }

  try {
    const autoBid = await dao.getAutoBidByVehicleAndBuyer(vehicleId, buyerId);
    if (!autoBid) {
      return sendNotFound(res, 'Auto bid not found');
    }
    return sendSuccess(res, 'Auto bid data retrieved successfully', autoBid);
  } catch (error) {
    console.error('Error fetching auto bid data:', error);
    return sendInternalError(res, 'Internal server error');
  }
}

export async function updateAutoBid(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);
  const { start_amount, max_bid, step_amount } = req.body || {};

  if (!buyerId) {
    return sendUnauthorized(res, 'Buyer authentication required');
  }

  if (isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid vehicle ID');
  }

  // Validate input parameters
  const updateData: any = {};
  const hasStart = start_amount !== undefined;
  const hasMax = max_bid !== undefined;
  const hasStep = step_amount !== undefined;

  if (hasStart) {
    const startAmt = Number(start_amount);
    if (isNaN(startAmt)) {
      return sendValidationError(res, 'Invalid start_amount');
    }
    updateData.bid_start_amt = startAmt;
  }

  if (hasMax) {
    const maxBid = Number(max_bid);
    if (isNaN(maxBid)) {
      return sendValidationError(res, 'Invalid max_bid');
    }
    updateData.max_bid_amt = maxBid;
  }

  if (hasStep) {
    const stepAmt = Number(step_amount);
    if (isNaN(stepAmt)) {
      return sendValidationError(res, 'Invalid step_amount');
    }
    updateData.step_amt = stepAmt;
  }

  // Recalculate max_steps and pending_steps if start_amount, max_bid, or step_amount changed
  if (hasStart || hasMax || hasStep) {
    try {
      const existingAutoBid = await dao.getAutoBidByVehicleAndBuyer(vehicleId, buyerId);
      if (!existingAutoBid) {
        return sendNotFound(res, 'Auto bid not found');
      }

      const startAmt = updateData.bid_start_amt ?? existingAutoBid.bid_start_amt;
      const maxBidAmt = updateData.max_bid_amt ?? existingAutoBid.max_bid_amt;
      const stepAmt = updateData.step_amt ?? existingAutoBid.step_amt;

      // Get vehicle details for validation
      const vehicle = await vehicleDao.getVehicleById(vehicleId);
      if (!vehicle) {
        return sendNotFound(res, 'Vehicle not found');
      }

      // Validate start amount against vehicle base price
      if (vehicle.base_price != null && startAmt < Number(vehicle.base_price)) {
        return sendBusinessError(res, 'Start amount did not reach base price');
      }
      
      // Validate max bid against vehicle max price
      if (vehicle.max_price != null && maxBidAmt > Number(vehicle.max_price)) {
        return sendBusinessError(res, 'Max bid amount exceeds vehicle maximum price');
      }
      
      // Validate step amount - must be at least 1000
      if (stepAmt < 1000) {
        return sendBusinessError(res, 'Step amount must be at least 1000');
      }

      // Enforce minimum bid difference
      if (maxBidAmt - startAmt < 1000) {
        return sendBusinessError(res, 'Bid difference must be at least 1000');
      }

      updateData.max_steps = Math.ceil((maxBidAmt - startAmt) / Math.max(stepAmt, 1));
      updateData.pending_steps = Math.ceil((maxBidAmt - startAmt) / Math.max(stepAmt, 1));
    } catch (error) {
      console.error('Error fetching existing auto bid:', error);
      return sendInternalError(res, 'Internal server error');
    }
  }

  try {
    const success = await dao.updateAutoBid(vehicleId, buyerId, updateData);
    if (!success) {
      return sendNotFound(res, 'Auto bid not found or no changes made');
    }
    return sendSuccess(res, 'Auto bid updated successfully', { vehicleId, buyerId, updateData });
  } catch (error) {
    console.error('Error updating auto bid:', error);
    return sendInternalError(res, 'Internal server error');
  }
}

export async function removeAutoBid(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);

  if (!buyerId) {
    return sendUnauthorized(res, 'Buyer authentication required');
  }

  if (isNaN(vehicleId)) {
    return sendValidationError(res, 'Invalid vehicle ID');
  }

  try {
    const success = await dao.removeAutoBid(vehicleId, buyerId);
    if (!success) {
      return sendNotFound(res, 'Auto bid not found');
    }
    return sendSuccess(res, 'Auto bid removed successfully', { vehicleId, buyerId });
  } catch (error) {
    console.error('Error removing auto bid:', error);
    return sendInternalError(res, 'Internal server error');
  }
}

