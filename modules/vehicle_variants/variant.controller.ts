import { Request, Response } from 'express';
import * as service from './variant.service';

export async function list(req: Request, res: Response) { const limit = Number(req.query.limit ?? 100); const offset = Number(req.query.offset ?? 0); res.json(await service.list(limit, offset)); }
export async function get(req: Request, res: Response) { const id = Number(req.params.id); const item = await service.get(id); if (!item) return res.status(404).json({ message: 'Variant not found' }); res.json(item); }
export async function create(req: Request, res: Response) { const created = await service.create(req.body); res.status(201).json(created); }
export async function update(req: Request, res: Response) { const id = Number(req.params.id); const updated = await service.update(id, req.body); if (!updated) return res.status(404).json({ message: 'Variant not found' }); res.json(updated); }
export async function remove(req: Request, res: Response) { const id = Number(req.params.id); const ok = await service.remove(id); if (!ok) return res.status(404).json({ message: 'Variant not found' }); res.status(204).send(); }


