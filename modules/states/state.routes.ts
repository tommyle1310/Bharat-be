import { Router } from 'express';
import * as dao from './state.dao';
import { sendSuccess, sendValidationError } from '../../utils/response';

const router = Router();

// Get all states
router.get('/', async (_req, res) => {
  try {
    const states = await dao.list();
    return sendSuccess(res, 'States retrieved successfully', states);
  } catch (error) {
    console.error('Error fetching states:', error);
    return sendValidationError(res, 'Failed to fetch states');
  }
});

// Search states
router.get('/search', async (req, res) => {
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
    const [states, total] = await Promise.all([
      dao.searchStates(query, limit, offset),
      dao.getStatesSearchCount(query)
    ]);

    const result = {
      states,
      total,
      limit,
      offset,
      query
    };

    return sendSuccess(res, 'State search completed successfully', result);
  } catch (error) {
    console.error('Error searching states:', error);
    return sendValidationError(res, 'Failed to search states');
  }
});

// Update state
router.put('/', async (req, res) => { 
  try {
    await dao.upsert(req.body); 
    return sendSuccess(res, 'State updated successfully');
  } catch (error) {
    console.error('Error updating state:', error);
    return sendValidationError(res, 'Failed to update state');
  }
});

export default router;


