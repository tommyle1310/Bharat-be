import { Request, Response } from 'express';
import * as service from './vehicle.service';
import { sendSuccess, sendError, sendNotFound, sendCreated, sendNoContent, sendValidationError } from '../../utils/response';

export async function list(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const data = await service.list(page, pageSize);
  return sendSuccess(res, 'Vehicles retrieved successfully', data);
}

export async function get(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return sendValidationError(res, 'Invalid vehicle id');
  }
  const buyerId = req.buyer?.id;
  const businessVertical = String(req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  const item = await service.getVehicleDetails(id, buyerId, businessVertical, bucketId);
  if (!item) return sendNotFound(res, 'Vehicle not found');
  return sendSuccess(res, 'Vehicle details retrieved successfully', item);
}

export async function create(req: Request, res: Response) {
  const created = await service.create(req.body);
  return sendCreated(res, 'Vehicle created successfully', created);
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  if (!updated) return sendNotFound(res, 'Vehicle not found');
  return sendSuccess(res, 'Vehicle updated successfully', updated);
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const ok = await service.remove(id);
  if (!ok) return sendNotFound(res, 'Vehicle not found');
  return sendNoContent(res, 'Vehicle removed successfully');
}

export async function groups(req: Request, res: Response) {
  const businessVertical = String(req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const data = await service.groups(businessVertical);
  return sendSuccess(res, 'Vehicle groups retrieved successfully', data);
}

export async function listByGroup(req: Request, res: Response) {
  let type = String(req.query.type || '').toLowerCase();
  
  // Handle legacy typo gracefully
  if (type === 'aunction_status') {
    type = 'auction_status';
  }
  
  const title = String(req.query.title || '');
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  
  console.log('check', type, title, page, pageSize, 'businessVertical:', businessVertical, 'bucketId:', bucketId);
  
  // For Bank business vertical, if bucketId is provided but no type/title, get all vehicles from that bucket
  if (businessVertical === 'B' && bucketId && (!type || !title)) {
    const buyerId = req.buyer?.id;
    const data = await service.listByGroup('all', '', page, pageSize, buyerId, businessVertical, bucketId);
    return sendSuccess(res, 'Vehicles by group retrieved successfully', data);
  }
  
  if (!type || !title) {
    return sendValidationError(res, 'type and title query params are required');
  }
  
  // Validate type is one of the allowed values
  if (!['state', 'auction_status', 'all', 'vehicle_type'].includes(type)) {
    return sendValidationError(res, 'Invalid type. Must be "state", "vehicle_type", "auction_status", or "all"');
  }

  const buyerId = req.buyer?.id;
  
  // For Bank business vertical with vehicle_type, extract vehicleTypeId from title
  let vehicleTypeId: number | undefined;
  if (businessVertical === 'B' && type === 'vehicle_type') {
    // Check multiple possible parameter names for vehicle type ID
    const typeIdFromParams = req.query.vehicleTypeId || req.query.vehicle_type || title;
    vehicleTypeId = Number(typeIdFromParams);
    if (isNaN(vehicleTypeId)) {
      return sendValidationError(res, 'Invalid vehicleTypeId for vehicle_type filtering. Please provide a valid numeric vehicle type ID.');
    }
  }
  
  const data = await service.listByGroup(type as 'state' | 'auction_status' | 'all' | 'vehicle_type', title, page, pageSize, buyerId, businessVertical, bucketId, vehicleTypeId);
  return sendSuccess(res, 'Vehicles by group retrieved successfully', data);
}

export async function search(req: Request, res: Response) {
  const keyword = String(req.query.keyword);
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const buyerId = req.buyer?.id;
  const businessVertical = String(req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  const data = await service.searchVehicles(keyword, page, pageSize, buyerId, businessVertical, bucketId);
  return sendSuccess(res, 'Vehicle search completed successfully', data);
}
export async function searchByGroup(req: Request, res: Response) {
  const keyword = String(req.query.keyword);
  const type = String(req.query.type || '').toLowerCase();
  const title = String(req.query.title);
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const buyerId = req.buyer?.id;
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  
  // For Bank business vertical with vehicle_type, extract vehicleTypeId from title
  let vehicleTypeId: number | undefined;
  if (businessVertical === 'B' && type === 'vehicle_type') {
    const typeIdFromParams = req.query.vehicleTypeId || req.query.vehicle_type || title;
    vehicleTypeId = Number(typeIdFromParams);
    if (isNaN(vehicleTypeId)) {
      return sendValidationError(res, 'Invalid vehicleTypeId for vehicle_type filtering. Please provide a valid numeric vehicle type ID.');
    }
  }
  
  const data = await service.searchVehiclesByGroup(keyword, type as 'state' | 'auction_status' | 'all' | 'vehicle_type', title, page, pageSize, buyerId, businessVertical, bucketId, vehicleTypeId);
  return sendSuccess(res, 'Vehicle search by group completed successfully', data);
}

export async function filterByGroup(req: Request, res: Response) {
  const type = String(req.query.type || '').toLowerCase();
  const title = String(req.query.title);
  const vehicleType = String(req.query.vehicle_type || '');
  const vehicleFuel = String(req.query.fuel || req.query.vehicle_fuel || '');
  const ownership = String(req.query.ownership || '');
  const rcAvailable = String(req.query.rc_available || '');
  const state = String(req.query.state || '');
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  
  if (!type || !title) {
    return sendValidationError(res, 'type and title query params are required');
  }
  
  // Validate type is one of the allowed values
  if (!['state', 'auction_status', 'all', 'vehicle_type'].includes(type)) {
    return sendValidationError(res, 'Invalid type. Must be "state", vehicle_type "auction_status", or "all"');
  }

  // For Bank business vertical with vehicle_type, extract vehicleTypeId from title
  let vehicleTypeId: number | undefined;
  if (businessVertical === 'B' && type === 'vehicle_type') {
    const typeIdFromParams = req.query.vehicleTypeId || req.query.vehicle_type || title;
    vehicleTypeId = Number(typeIdFromParams);
    if (isNaN(vehicleTypeId)) {
      return sendValidationError(res, 'Invalid vehicleTypeId for vehicle_type filtering. Please provide a valid numeric vehicle type ID.');
    }
  }

  const buyerId = req.buyer?.id;
  const data = await service.filterVehiclesByGroup(
    type as 'state' | 'auction_status' | 'all' | 'vehicle_type', 
    title, 
    vehicleType, 
    vehicleFuel, 
    ownership, 
    rcAvailable,
    state,
    page, 
    pageSize,
    buyerId,
    businessVertical,
    bucketId,
    vehicleTypeId
  );
  return sendSuccess(res, 'Vehicle filter by group completed successfully', data);
}

export async function getOwnershipTypes(req: Request, res: Response) {
  const data = await service.getOwnershipTypes();
  return sendSuccess(res, 'Ownership types retrieved successfully', data);
}

export async function getFuelTypes(req: Request, res: Response) {
  const data = await service.getFuelTypes();
  return sendSuccess(res, 'Fuel types retrieved successfully', data);
}

export async function getVehicleTypes(req: Request, res: Response) {
  const data = await service.getVehicleTypes();
  return sendSuccess(res, 'Vehicle types retrieved successfully', data);
}

export async function getVehicleSubcategories(req: Request, res: Response) {
  const data = await service.getVehicleSubcategories();
  return sendSuccess(res, 'Vehicle subcategories retrieved successfully', data);
}
export async function getSelectedVehicleImages(req: Request, res: Response) {
  console.log("req.query:", req.query); // debug
  const id = Number(req.query.id);

  if (isNaN(id)) {
    return sendValidationError(res, "Invalid vehicle_id");
  }

  const data = await service.getSelectedVehicleImages(id);
  return sendSuccess(res, 'Vehicle images retrieved successfully', data);
}
  
export async function filterAll(req: Request, res: Response) {
  const vehicleType = String(req.query.vehicle_type || '');
  const vehicleFuel = String(req.query.fuel || req.query.vehicle_fuel || '');
  const ownership = String(req.query.ownership || '');
  const rcAvailable = String(req.query.rc_available || '');
  const state = String(req.query.state || '');
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const buyerId = req.buyer?.id;
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  const data = await service.filterVehiclesAll(
    vehicleType,
    vehicleFuel,
    ownership,
    rcAvailable,
    state,
    page,
    pageSize,
    buyerId,
    businessVertical,
    bucketId
  );
  return sendSuccess(res, 'Vehicle filter completed successfully', data);
}

export async function bucketsByGroup(req: Request, res: Response) {
  let type = String(req.query.type || '').toLowerCase();
  if (type === 'aunction_status') type = 'auction_status';
  const title = String(req.query.title || '');
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 5);
  const businessVertical = String(req.params.businessVertical || req.query.businessVertical || 'A').toUpperCase() as 'A'|'B'|'I';
  const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined;
  
  // 👉 NEW: Extract keyword from query
  const keyword = String(req.query.keyword || '').trim();

  if (!type || !['state','auction_status','all', 'vehicle_type'].includes(type)) {
    return sendValidationError(res, 'Invalid type. Must be "state", "auction_status", "vehicle_type", or "all"');
  }

  // 👉 NEW: Pass keyword to the service function
  const data = await service.listBucketsByGroup(type as 'state'|'auction_status'|'all'|'vehicle_type', title, page, pageSize, businessVertical, bucketId, keyword);
  return sendSuccess(res, 'Buckets by group retrieved successfully', data);
}
  
  



