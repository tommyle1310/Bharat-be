import { Request, Response } from 'express';
import * as dao from './buyer_bids.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';

export async function history(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  if (Number.isNaN(buyerId)) return res.status(400).json({ message: 'Invalid buyerId' });
  const rows = await dao.getBuyerBidHistory(buyerId);
  res.json(rows);
}

export async function historyByVehicle(req: Request, res: Response) {
  const buyerId = Number(req.params.buyerId);
  const vehicleId = Number(req.params.vehicleId);
  if (Number.isNaN(buyerId) || Number.isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid buyerId or vehicleId' });
  }
  const rows = await dao.getBuyerBidHistoryByVehicle(buyerId, vehicleId);
  res.json(rows);
}

export async function manualBid(req: Request, res: Response) {
  const { buyer_id, vehicle_id, bid_amount } = req.body || {};
  const buyerId = Number(buyer_id);
  const vehicleId = Number(vehicle_id);
  const bidAmt = Number(bid_amount);
  if ([buyerId, vehicleId, bidAmt].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ message: 'buyer_id, vehicle_id, bid_amount are required' });
  }

  const vehicle = await vehicleDao.getVehicleById(vehicleId);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  if (vehicle.base_price != null && bidAmt < Number(vehicle.base_price)) {
    return res.status(400).json({ message: 'Bid amount did not reach base price' });
  }

  const lastBid = await dao.getLatestBuyerBidForVehicle(buyerId, vehicleId);
  console.log(`Debug: buyerId=${buyerId}, vehicleId=${vehicleId}, lastBid=${lastBid}, bidAmt=${bidAmt}`);
  if (lastBid != null) {
    if (bidAmt <= lastBid) {
      return res.status(400).json({ message: 'Bid must be higher than previous bid' });
    }
    const bidDifference = bidAmt - lastBid;
    console.log(`Debug: bidDifference=${bidDifference}`);
    if (bidDifference < 1000) {
      return res.status(400).json({ message: 'Bid difference must be at least 1000' });
    }
  }

  // Get current top bid for this vehicle
  const currentTopBid = await dao.getTopBidForVehicle(vehicleId);
  const currentTopBidAmount = currentTopBid?.amount ?? 0;
  
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

  // Update vehicle table with new top bidder if this is the new top bid
  if (isTopBid) {
    await vehicleDao.updateVehicle(vehicleId, {
      top_bidder_id: buyerId
    });
  }

  res.status(201).json({ message: 'Bid placed' });
}


