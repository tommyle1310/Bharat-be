import * as dao from './wishlist.dao';

export async function list(buyerId: number, businessVertical: 'A'|'B'|'I' = 'A', limit?: number, offset?: number) {
  return dao.getWishlist(buyerId, businessVertical, limit, offset);
}


