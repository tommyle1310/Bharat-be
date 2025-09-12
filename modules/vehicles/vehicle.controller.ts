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
  const buyerId = req.buyer?.id;
  const item = await service.getVehicleDetails(id, buyerId);
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

export async function groups(req: Request, res: Response) {
  const businessVertical = String(req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const data = await service.groups(businessVertical);
  res.json(data);
}

export async function listByGroup(req: Request, res: Response) {
  let type = String(req.query.type || '').toLowerCase();
  
  // Handle legacy typo gracefully
  if (type === 'aunction_status') {
    type = 'auction_status';
  }
  
  const title = String(req.query.title);
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  console.log('check', type, title, limit, offset);
  
  if (!type || !(title)) {
    return res.status(400).json({ message: 'type and title query params are required' });
  }
  
  // Validate type is one of the allowed values
  if (!['state', 'auction_status', 'all'].includes(type)) {
    throw new Error('Invalid type. Must be "state", "auction_status", or "all"');
  }

  const buyerId = req.buyer?.id;
  const data = await service.listByGroup(type as 'state' | 'auction_status' | 'all', title, limit, offset, buyerId, businessVertical);
  res.json(data);
}

export async function search(req: Request, res: Response) {
  const keyword = String(req.query.keyword);
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const buyerId = req.buyer?.id;
  const data = await service.searchVehicles(keyword, limit, offset, buyerId);
  res.json(data);
}
export async function searchByGroup(req: Request, res: Response) {
  const keyword = String(req.query.keyword);
  const type = String(req.query.type || '').toLowerCase();
  const title = String(req.query.title);
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const buyerId = req.buyer?.id;
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const data = await service.searchVehiclesByGroup(keyword, type as 'state' | 'auction_status' | 'all', title, limit, offset, buyerId, businessVertical);
  res.json(data);
}

export async function filterByGroup(req: Request, res: Response) {
  const type = String(req.query.type || '').toLowerCase();
  const title = String(req.query.title);
  const vehicleType = String(req.query.vehicle_type || '');
  const vehicleFuel = String(req.query.fuel || req.query.vehicle_fuel || '');
  const ownership = String(req.query.ownership || '');
  const rcAvailable = String(req.query.rc_available || '');
  const state = String(req.query.state || '');
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  
  if (!type || !title) {
    return res.status(400).json({ message: 'type and title query params are required' });
  }
  
  // Validate type is one of the allowed values
  if (!['state', 'auction_status', 'all'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type. Must be "state", "auction_status", or "all"' });
  }

  const buyerId = req.buyer?.id;
  const data = await service.filterVehiclesByGroup(
    type as 'state' | 'auction_status' | 'all', 
    title, 
    vehicleType, 
    vehicleFuel, 
    ownership, 
    rcAvailable,
    state,
    limit, 
    offset,
    buyerId,
    businessVertical
  );
  res.json(data);
}

export async function getOwnershipTypes(req: Request, res: Response) {
  const data = await service.getOwnershipTypes();
  res.json(data);
}

export async function getFuelTypes(req: Request, res: Response) {
  const data = await service.getFuelTypes();
  res.json(data);
}

  export async function getVehicleTypes(req: Request, res: Response) {
    const data = await service.getVehicleTypes();
    res.json(data);
  }
  export async function getSelectedVehicleImages(req: Request, res: Response) {
    console.log("req.query:", req.query); // debug
    const id = Number(req.query.id);
  
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid vehicle_id" });
    }
  
    const data = await service.getSelectedVehicleImages(id);
    res.json(data);
  }
  
  



