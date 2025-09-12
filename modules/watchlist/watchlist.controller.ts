import { Request, Response } from 'express';
import * as service from './watchlist.service';

export async function add(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.body.vehicle_id || req.params.vehicleId);
  if (!buyerId || Number.isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid buyer or vehicle id' });
  }
  await service.add(buyerId, vehicleId);
  res.status(204).send();
}

export async function list(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  if (!buyerId) {
    return res.status(400).json({ message: 'Invalid buyer' });
  }
  const items = await service.list(buyerId, limit, offset);
  res.json(items);
}

export async function toggle(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const vehicleId = Number(req.body.vehicle_id || req.params.vehicleId);
  if (!buyerId || Number.isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid buyer or vehicle id' });
  }
  const result = await service.toggle(buyerId, vehicleId);
  res.json(result);
}


