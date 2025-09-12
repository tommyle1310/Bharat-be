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


