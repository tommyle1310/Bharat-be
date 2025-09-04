import { Vehicle } from './vehicle.model';
import * as dao from './vehicle.dao';
import { VehicleGroupItem, VehicleListItem } from './vehicle.dao';

export async function list(limit?: number, offset?: number) {
  return dao.listVehicles(limit, offset);
}

export async function get(id: number) {
  return dao.getVehicleById(id);
}

export async function create(payload: Vehicle) {
  const id = await dao.createVehicle(payload);
  return dao.getVehicleById(id);
}

export async function update(id: number, payload: Partial<Vehicle>) {
  const ok = await dao.updateVehicle(id, payload);
  if (!ok) return null;
  return dao.getVehicleById(id);
}

export async function remove(id: number) {
  return dao.deleteVehicle(id);
}

export async function groups(): Promise<VehicleGroupItem[]> {
  return dao.getGroups();
}

export async function listByGroup(type: 'state' | 'auction_status', title: string, limit?: number, offset?: number): Promise<VehicleListItem[]> {
  return dao.getVehiclesByGroup(type, title, limit, offset);
}


