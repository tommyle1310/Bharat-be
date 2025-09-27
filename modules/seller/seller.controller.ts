import { Request, Response } from 'express';
import * as service from './seller.service';
import { sendSuccess, sendValidationError, sendNotFound } from '../../utils/response';

/**
 * Get all sellers with pagination
 * GET /api/service/sellers?limit=50&offset=0
 */
export async function getAllSellers(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  // Validate pagination parameters
  if (limit < 1 || limit > 100) {
    return sendValidationError(res, 'Limit must be between 1 and 100');
  }
  
  if (offset < 0) {
    return sendValidationError(res, 'Offset must be 0 or greater');
  }

  try {
    const result = await service.getAllSellers(limit, offset);
    return sendSuccess(res, 'Sellers retrieved successfully', result);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    return sendValidationError(res, 'Failed to fetch sellers');
  }
}

/**
 * Search sellers by name, email, contact person, phone, or GST number
 * GET /api/service/sellers/search?query=search_term&limit=50&offset=0
 */
export async function searchSellers(req: Request, res: Response) {
  const query = String(req.query.query ?? '').trim();
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  // Validate pagination parameters
  if (limit < 1 || limit > 100) {
    return sendValidationError(res, 'Limit must be between 1 and 100');
  }
  
  if (offset < 0) {
    return sendValidationError(res, 'Offset must be 0 or greater');
  }

  // Validate search query
  if (!query) {
    return sendValidationError(res, 'Search query is required');
  }

  if (query.length < 2) {
    return sendValidationError(res, 'Search query must be at least 2 characters long');
  }

  try {
    const result = await service.searchSellers({ query, limit, offset });
    return sendSuccess(res, 'Seller search completed successfully', result);
  } catch (error) {
    console.error('Error searching sellers:', error);
    return sendValidationError(res, 'Failed to search sellers');
  }
}

/**
 * Get seller by ID
 * GET /api/service/sellers/:id
 */
export async function getSellerById(req: Request, res: Response) {
  const sellerId = Number(req.params.id);
  
  if (Number.isNaN(sellerId) || sellerId < 1) {
    return sendValidationError(res, 'Invalid seller ID');
  }

  try {
    const seller = await service.getSellerById(sellerId);
    
    if (!seller) {
      return sendNotFound(res, 'Seller not found');
    }

    return sendSuccess(res, 'Seller details retrieved successfully', seller);
  } catch (error) {
    console.error('Error fetching seller by ID:', error);
    return sendValidationError(res, 'Failed to fetch seller details');
  }
}
