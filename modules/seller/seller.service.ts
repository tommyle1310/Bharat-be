import * as dao from './seller.dao';
import { SellerListItem, SellerSearchParams } from './seller.model';

export async function getAllSellers(limit = 50, offset = 0): Promise<{
  sellers: SellerListItem[];
  total: number;
  limit: number;
  offset: number;
}> {
  const [sellers, total] = await Promise.all([
    dao.getAllSellers(limit, offset),
    dao.getSellersCount()
  ]);

  return {
    sellers,
    total,
    limit,
    offset
  };
}

export async function searchSellers(params: SellerSearchParams): Promise<{
  sellers: SellerListItem[];
  total: number;
  limit: number;
  offset: number;
  query: string;
}> {
  const { query = '', limit = 50, offset = 0 } = params;
  
  const [sellers, total] = await Promise.all([
    dao.searchSellers(params),
    dao.getSellersSearchCount(query)
  ]);

  return {
    sellers,
    total,
    limit,
    offset,
    query
  };
}

export async function getSellerById(sellerId: number) {
  return await dao.getSellerById(sellerId);
}
