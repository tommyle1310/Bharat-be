import * as dao from './win.dao';

export async function getWinningVehicles(
  buyerId: number, 
  businessVertical: 'A'|'B'|'I' = 'A', 
  page?: number, 
  pageSize?: number, 
  keyword?: string
) {
  return dao.getWinningVehicles(buyerId, businessVertical, page, pageSize, undefined, keyword);
}
