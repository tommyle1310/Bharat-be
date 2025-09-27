import { Request, Response } from 'express';
import * as dao from './image.dao';

export async function listByVehicle(req: Request, res: Response) {
  const vehicleId = Number(req.params.vehicleId);
  res.json(await dao.listByVehicle(vehicleId));
}

export async function create(req: Request, res: Response) {
  const id = await dao.create(req.body);
  res.status(201).json({ vehicle_image_id: id });
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const ok = await dao.remove(id);
  if (!ok) return res.status(404).json({ message: 'Image not found' });
  res.status(204).send();
}


