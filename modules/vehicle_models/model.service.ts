import { VehicleModel } from './model.model';
import * as dao from './model.dao';

export function list(limit?: number, offset?: number) { return dao.list(limit, offset); }
export function get(id: number) { return dao.getById(id); }
export async function create(payload: VehicleModel) { const id = await dao.create(payload); return dao.getById(id); }
export async function update(id: number, payload: Partial<VehicleModel>) { const ok = await dao.update(id, payload); return ok ? dao.getById(id) : null; }
export function remove(id: number) { return dao.remove(id); }


