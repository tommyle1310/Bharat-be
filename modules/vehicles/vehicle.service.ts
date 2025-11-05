import { Vehicle } from './vehicle.model';
import * as dao from './vehicle.dao';
import { VehicleGroupItem, VehicleListItem } from './vehicle.dao';

export async function list(page?: number, pageSize?: number) {
  return dao.listVehicles(page, pageSize);
}

export async function getVehicleDetails(id: number, buyerId?: number, businessVertical: 'A'|'B'|'I' = 'A', bucketId?: number) {
  return dao.getVehicleDetails(id, buyerId, businessVertical, bucketId);
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

export async function groups(businessVertical: 'A'|'B'|'I' = 'A') {
  if (businessVertical === 'B') {
    // For Bank business vertical, return all buckets with vehicle type information
    return dao.getBucketsByGroup('all', '', 1, 100, businessVertical); // Get all buckets (high pageSize to get all)
  }
  return dao.getGroups(businessVertical);
}

export async function listByGroup(type: 'state' | 'auction_status' | 'all' | 'vehicle_type', title: string, page?: number, pageSize?: number, buyerId?: number, businessVertical: 'A' | 'B' | 'I' = 'A', bucketId?: number, vehicleTypeId?: number) {
  return dao.getVehiclesByGroup(type, title, page, pageSize, buyerId, businessVertical, bucketId, vehicleTypeId);
}

export async function searchVehicles(keyword: string, page?: number, pageSize?: number, buyerId?: number, businessVertical: 'A'|'B'|'I' = 'A', bucketId?: number) {
  return dao.searchVehicles(keyword, page, pageSize, buyerId, businessVertical, bucketId);
}
export async function searchVehiclesByGroup(keyword: string, type: 'state' | 'auction_status' | 'all' | 'vehicle_type', title: string, page?: number, pageSize?: number, buyerId?: number, businessVertical: 'A' | 'B' | 'I' = 'A', bucketId?: number, vehicleTypeId?: number) {
  return dao.searchVehiclesByGroup(keyword, type, title, page, pageSize, buyerId, businessVertical, bucketId, vehicleTypeId);
}

export async function filterVehiclesByGroup(
  type: 'state' | 'auction_status' | 'all' | 'vehicle_type',
  title: string,
  vehicleType: string,
  vehicleFuel: string,
  ownership: string,
  rcAvailable: string,
  state: string,
  page?: number,
  pageSize?: number,
  buyerId?: number,
  businessVertical: 'A' | 'B' | 'I' = 'A',
  bucketId?: number,
  vehicleTypeId?: number
) {
  return dao.filterVehiclesByGroup(type, title, vehicleType, vehicleFuel, ownership, rcAvailable, state, page, pageSize, buyerId, businessVertical, bucketId, vehicleTypeId);
}

export async function filterVehiclesAll(
  vehicleType: string,
  vehicleFuel: string,
  ownership: string,
  rcAvailable: string,
  state: string,
  page?: number,
  pageSize?: number,
  buyerId?: number,
  businessVertical: 'A'|'B'|'I' = 'A',
  bucketId?: number,
) {
  return dao.filterVehiclesAll(vehicleType, vehicleFuel, ownership, rcAvailable, state, page, pageSize, buyerId, businessVertical, bucketId);
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

export async function getVehicleSubcategories() {
  return dao.getVehicleSubcategories();
}
export async function getSelectedVehicleImages(id: number) {
  console.log('check id', id)
  return dao.getSelectedVehicleImages(id);
}

export async function listBucketsByGroup(
  type: 'state'|'auction_status'|'all'|'vehicle_type', 
  title: string, 
  page?: number, 
  pageSize?: number, 
  businessVertical: 'A'|'B'|'I' = 'A', 
  bucketId?: number, 
  keyword?: string // 👉 NEW: Added keyword parameter
) {
  return dao.getBucketsByGroup(type, title, page, pageSize, businessVertical, bucketId, keyword);
}