import { Request, Response } from 'express';
import * as dao from './auto_bid.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';
import { checkBuyerAccess } from '../buyer_access/buyer_access.dao';

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
      return res.status(403).json({ message: `You don't have access to place bid on ${accessTypes}` });
    }
  } catch (accessError) {
    return res.status(403).json({ message: (accessError as Error).message });
  }
  console.log('check set autobid', buyerId, vehicleId, startAmt, maxBid, stepAmt);
  if ([buyerId, vehicleId, startAmt, maxBid, stepAmt].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ message: 'buyer_id, vehicle_id, start_amount, max_bid, step_amount required' });
  }

  // Enforce minimum bid difference
  if (maxBid - startAmt < 1000) {
    return res.status(400).json({ message: 'Bid difference must be at least 1000' });
  }

  const vehicle = await vehicleDao.getVehicleById(vehicleId);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  if (vehicle.base_price != null && startAmt < Number(vehicle.base_price)) {
    return res.status(400).json({ message: 'Start amount did not reach base price' });
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

  res.status(200).json({ message: 'Auto bid configured' });
}

export async function getAutoBidsByBuyer(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) {
    return res.status(401).json({ message: 'Buyer authentication required' });
  }

  try {
    const autoBids = await dao.getAutoBidsByBuyer(buyerId);
    res.json(autoBids);
  } catch (error) {
    console.error('Error fetching auto bids for buyer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAutoBidData(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);

  if (!buyerId) {
    return res.status(401).json({ message: 'Buyer authentication required' });
  }

  if (isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid vehicle ID' });
  }

  try {
    const autoBid = await dao.getAutoBidByVehicleAndBuyer(vehicleId, buyerId);
    if (!autoBid) {
      return res.status(404).json({ message: 'Auto bid not found' });
    }
    res.json(autoBid);
  } catch (error) {
    console.error('Error fetching auto bid data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateAutoBid(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);
  const { start_amount, max_bid, step_amount } = req.body || {};

  if (!buyerId) {
    return res.status(401).json({ message: 'Buyer authentication required' });
  }

  if (isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid vehicle ID' });
  }

  // Validate input parameters
  const updateData: any = {};
  const hasStart = start_amount !== undefined;
  const hasMax = max_bid !== undefined;
  const hasStep = step_amount !== undefined;

  if (hasStart) {
    const startAmt = Number(start_amount);
    if (isNaN(startAmt)) {
      return res.status(400).json({ message: 'Invalid start_amount' });
    }
    updateData.bid_start_amt = startAmt;
  }

  if (hasMax) {
    const maxBid = Number(max_bid);
    if (isNaN(maxBid)) {
      return res.status(400).json({ message: 'Invalid max_bid' });
    }
    updateData.max_bid_amt = maxBid;
  }

  if (hasStep) {
    const stepAmt = Number(step_amount);
    if (isNaN(stepAmt)) {
      return res.status(400).json({ message: 'Invalid step_amount' });
    }
    updateData.step_amt = stepAmt;
  }

  // Recalculate max_steps and pending_steps if start_amount, max_bid, or step_amount changed
  if (hasStart || hasMax || hasStep) {
    try {
      const existingAutoBid = await dao.getAutoBidByVehicleAndBuyer(vehicleId, buyerId);
      if (!existingAutoBid) {
        return res.status(404).json({ message: 'Auto bid not found' });
      }

      const startAmt = updateData.bid_start_amt ?? existingAutoBid.bid_start_amt;
      const maxBidAmt = updateData.max_bid_amt ?? existingAutoBid.max_bid_amt;
      const stepAmt = updateData.step_amt ?? existingAutoBid.step_amt;

      // Enforce minimum bid difference
      if (maxBidAmt - startAmt < 1000) {
        return res.status(400).json({ message: 'Bid difference must be at least 1000' });
      }

      updateData.max_steps = Math.ceil((maxBidAmt - startAmt) / Math.max(stepAmt, 1));
      updateData.pending_steps = Math.ceil((maxBidAmt - startAmt) / Math.max(stepAmt, 1));
    } catch (error) {
      console.error('Error fetching existing auto bid:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  try {
    const success = await dao.updateAutoBid(vehicleId, buyerId, updateData);
    if (!success) {
      return res.status(404).json({ message: 'Auto bid not found or no changes made' });
    }
    res.json({ message: 'Auto bid updated successfully' });
  } catch (error) {
    console.error('Error updating auto bid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeAutoBid(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.params.vehicleId);

  if (!buyerId) {
    return res.status(401).json({ message: 'Buyer authentication required' });
  }

  if (isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid vehicle ID' });
  }

  try {
    const success = await dao.removeAutoBid(vehicleId, buyerId);
    if (!success) {
      return res.status(404).json({ message: 'Auto bid not found' });
    }
    res.json({ message: 'Auto bid removed successfully' });
  } catch (error) {
    console.error('Error removing auto bid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

