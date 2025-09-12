import * as dao from './wishlist.dao';

export async function list(buyerId: number, businessVertical: 'A'|'B'|'I' = 'A', limit?: number, offset?: number) {
  return dao.getWishlist(buyerId, businessVertical, limit, offset);
}

export interface UpdatePreferencesInput {
  buyerId: number;
  businessVertical: 'A'|'B'|'I';
  vehicleType: string;
  vehicleFuel: string;
  ownership: string;
  rcAvailable: string;
  sellerId: string;
  regstate: string;
  makeIds?: string;
  subcategoryIds?: string;
}

export async function updatePreferences(input: UpdatePreferencesInput) {
  return dao.updateWishlistPreferences(input);
}


