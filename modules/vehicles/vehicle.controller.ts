import { Request, Response } from 'express';
import * as service from './vehicle.service';

export async function list(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const data = await service.list(limit, offset);
  res.json(data);
}

export async function get(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid vehicle id' });
  }
  const item = await service.get(id);
  if (!item) return res.status(404).json({ message: 'Vehicle not found' });
  res.json(item);
}

export async function create(req: Request, res: Response) {
  const created = await service.create(req.body);
  res.status(201).json(created);
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  if (!updated) return res.status(404).json({ message: 'Vehicle not found' });
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const ok = await service.remove(id);
  if (!ok) return res.status(404).json({ message: 'Vehicle not found' });
  res.status(204).send();
}

export async function groups(_req: Request, res: Response) {
  const data = await service.groups();
  res.json(data);
}

export async function listByGroup(req: Request, res: Response) {
  let type = String(req.query.type || '').toLowerCase();
  
  // Handle legacy typo gracefully
  if (type === 'aunction_status') {
    type = 'auction_status';
  }
  
  const id = Number(req.query.id);
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  console.log('check', type, id, limit, offset);
  
  if (!type || Number.isNaN(id)) {
    return res.status(400).json({ message: 'type and id query params are required' });
  }
  
  // Validate type is one of the allowed values
  if (type !== 'state' && type !== 'auction_status') {
    return res.status(400).json({ message: 'Invalid type. Must be "state" or "auction_status"' });
  }
  
  const data = await service.listByGroup(type as 'state' | 'auction_status', id, limit, offset);
  res.json(data);
}


