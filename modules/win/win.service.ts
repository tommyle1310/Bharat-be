import * as dao from './win.dao';
import { AuctionStatus } from './win.dao';

export async function getWinningVehicles(
  buyerId: number, 
  businessVertical: 'A'|'B'|'I' = 'A', 
  page?: number, 
  pageSize?: number, 
  keyword?: string,
  auctionStatusId?: number,
  auctionStatus?: AuctionStatus
) {
  const filters: any = {};
  
  if (auctionStatusId) {
    filters.auction_status_id = auctionStatusId;
  }
  
  if (auctionStatus) {
    filters.auction_status = auctionStatus;
  }
  
  const finalFilters = Object.keys(filters).length > 0 ? filters : undefined;
  return dao.getWinningVehicles(buyerId, businessVertical, page, pageSize, finalFilters, keyword);
}
