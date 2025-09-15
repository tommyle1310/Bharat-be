import * as dao from './watchlist.dao';

export async function add(userId: number, vehicleId: number) {
  return dao.addToWatchlist(userId, vehicleId);
}

export async function list(userId: number, limit?: number, offset?: number, keyword?: string) {
  return dao.getWatchlist(userId, limit, offset, keyword);
}

export async function toggle(userId: number, vehicleId: number) {
  return dao.toggleWatchlist(userId, vehicleId);
}


