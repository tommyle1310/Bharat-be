import * as dao from './wishlist.dao';

// Updated function signature to include keyword parameter for search functionality
export async function list(buyerId: number, businessVertical: 'A'|'B'|'I' = 'A', page?: number, pageSize?: number, keyword?: string) {
  return dao.getWishlist(buyerId, businessVertical, page, pageSize, undefined, keyword);
}

export interface UpdatePreferencesInput {
  buyerId: number;
  businessVertical: 'A'|'B'|'I';
  vehicleType: string;
  vehicleFuel: string;
  ownership: string;
  rcAvailable: string;
  sellerId: string;
  stateIds?: string;
  makeIds?: string;
  subcategoryIds?: string;
  categoryId?: string;
}

export async function updatePreferences(input: UpdatePreferencesInput) {
  return dao.updateWishlistPreferences(input);
}

export async function getConfiguration(buyerId: number) {
  return dao.getWishlistConfiguration(buyerId);
}


