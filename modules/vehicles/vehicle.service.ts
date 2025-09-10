import { Vehicle } from './vehicle.model';
import * as dao from './vehicle.dao';
import { VehicleGroupItem, VehicleListItem } from './vehicle.dao';

export async function list(limit?: number, offset?: number) {
  return dao.listVehicles(limit, offset);
}

export async function getVehicleDetails(id: number, buyerId?: number) {
  return dao.getVehicleDetails(id, buyerId);
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

export async function listByGroup(type: 'state' | 'auction_status' | 'all', title: string, limit?: number, offset?: number, buyerId?: number): Promise<VehicleListItem[]> {
  return dao.getVehiclesByGroup(type, title, limit, offset, buyerId);
}

export async function searchVehicles(keyword: string, limit?: number, offset?: number, buyerId?: number): Promise<dao.VehicleItem[]> {
  return dao.searchVehicles(keyword, limit, offset, buyerId);
}
export async function searchVehiclesByGroup(keyword: string, type: 'state' | 'auction_status' | 'all', title: string, limit?: number, offset?: number, buyerId?: number): Promise<dao.VehicleListItem[]> {
  return dao.searchVehiclesByGroup(keyword, type, title, limit, offset, buyerId);
}

export async function filterVehiclesByGroup(
  type: 'state' | 'auction_status' | 'all',
  title: string,
  vehicleType: string,
  vehicleFuel: string,
  ownership: string,
  rcAvailable: string,
  limit?: number,
  offset?: number,
  buyerId?: number
): Promise<dao.VehicleListItem[]> {
  return dao.filterVehiclesByGroup(type, title, vehicleType, vehicleFuel, ownership, rcAvailable, limit, offset, buyerId);
}

export async function getOwnershipTypes() {
  return dao.getOwnershipTypes();
}

export async function getFuelTypes() {
  return dao.getFuelTypes();
}

export async function getVehicleTypes() {
  return dao.getVehicleTypes();
}
export async function getSelectedVehicleImages(id: number) {
  console.log('check id', id)
  return dao.getSelectedVehicleImages(id);
}