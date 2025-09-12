import { Request, Response } from 'express';
import * as service from './wishlist.service';

export async function list(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  if (!buyerId) return res.status(400).json({ message: 'Invalid buyer' });
  const items = await service.list(buyerId, businessVertical, limit, offset);
  res.json(items);
}

export async function updatePreferences(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return res.status(400).json({ message: 'Invalid buyer' });

  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';

  const vehicleType = String((req.query.vehicleType || req.query.vehicle_type || '') as string);
  const vehicleFuel = String((req.query.fuel || req.query.vehicle_fuel || '') as string);
  const ownership = String((req.query.ownership || '') as string);
  const rcAvailable = String((req.query.rc_available || '') as string);
  const sellerId = String((req.query.sellerId || req.query.seller_id || '') as string);
  const regstate = String((req.query.regstate || '') as string);
  const makeIds = String((req.query.makeIds || req.query.make || '') as string);
  const subcategoryIds = String((req.query.subcategoryIds || req.query.subcategory || '') as string);

  try {
    const result = await service.updatePreferences({
      buyerId,
      businessVertical,
      vehicleType,
      vehicleFuel,
      ownership,
      rcAvailable,
      sellerId,
      regstate,
      makeIds,
      subcategoryIds,
    });
    res.json({ success: true, updated: result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update wishlist preferences' });
  }
}


