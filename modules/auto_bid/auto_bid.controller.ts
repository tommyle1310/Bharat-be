import { Request, Response } from 'express';
import * as dao from './auto_bid.dao';
import * as vehicleDao from '../vehicles/vehicle.dao';

export async function setAutoBid(req: Request, res: Response) {
  const { buyer_id, vehicle_id, start_amount, max_bid, step_amount } = req.body || {};
  const buyerId = Number(buyer_id);
  const vehicleId = Number(vehicle_id);
  const startAmt = Number(start_amount);
  const maxBid = Number(max_bid);
  const stepAmt = Number(step_amount);
  if ([buyerId, vehicleId, startAmt, maxBid, stepAmt].some((v) => Number.isNaN(v))) {
    return res.status(400).json({ message: 'buyer_id, vehicle_id, start_amount, max_bid, step_amount required' });
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


