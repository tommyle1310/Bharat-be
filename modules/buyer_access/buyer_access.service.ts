import { checkBuyerAccess, seedBuyerAccessData, getBuyerAccessSummary } from './buyer_access.dao';

export async function validateBuyerAccess(buyerId: number, vehicleId: number) {
  const accessCheck = await checkBuyerAccess(buyerId, vehicleId);
  
  if (!accessCheck.hasAccess) {
    const accessTypes = accessCheck.missingAccess.join(', ');
    throw new Error(`You don't have access to place bid on this vehicle`);
  }
  
  return accessCheck;
}

export async function seedAccessData(
  buyerId: number,
  sellerIds: number[],
  stateIds: number[],
  subcategoryIds: number[],
  vehicleTypeIds: number[],
  categoryId: number
) {
  return await seedBuyerAccessData(
    buyerId,
    sellerIds,
    stateIds,
    subcategoryIds,
    vehicleTypeIds,
    categoryId
  );
}

export async function getAccessSummary(buyerId: number) {
  return await getBuyerAccessSummary(buyerId);
}
