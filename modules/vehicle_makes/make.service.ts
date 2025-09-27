import { VehicleMake } from './make.model';
import * as dao from './make.dao';

export function list(limit?: number, offset?: number) {
  return dao.list(limit, offset);
}

export function get(id: number) {
  return dao.getById(id);
}

export async function create(payload: VehicleMake) {
  const id = await dao.create(payload);
  return dao.getById(id);
}

export async function update(id: number, payload: Partial<VehicleMake>) {
  const ok = await dao.update(id, payload);
  if (!ok) return null;
  return dao.getById(id);
}

export function remove(id: number) {
  return dao.remove(id);
}


