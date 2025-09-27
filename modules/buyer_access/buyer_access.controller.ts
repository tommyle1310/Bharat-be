import { Request, Response } from 'express';
import * as service from './buyer_access.service';

export async function checkAccess(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return res.status(400).json({ message: 'Invalid buyer' });

  const vehicleId = Number(req.params.vehicleId);
  if (!vehicleId || isNaN(vehicleId)) {
    return res.status(400).json({ message: 'Invalid vehicle ID' });
  }

  try {
    const accessCheck = await service.validateBuyerAccess(buyerId, vehicleId);
    res.json({ 
      success: true, 
      hasAccess: true,
      vehicleInfo: accessCheck.vehicleInfo
    });
  } catch (err) {
    const message = (err as Error).message;
    res.status(403).json({ 
      success: false, 
      hasAccess: false,
      message 
    });
  }
}

export async function seedAccess(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return res.status(400).json({ message: 'Invalid buyer' });

  const sellerIds = String(req.body.sellerIds || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const stateIds = String(req.body.stateIds || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const subcategoryIds = String(req.body.subcategoryIds || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const vehicleTypeIds = String(req.body.vehicleTypeIds || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const categoryId = Number(req.body.categoryId || 0);

  if (categoryId === 0) {
    return res.status(400).json({ message: 'categoryId is required' });
  }

  try {
    const result = await service.seedAccessData(
      buyerId,
      sellerIds,
      stateIds,
      subcategoryIds,
      vehicleTypeIds,
      categoryId
    );
    
    res.json({ 
      success: true, 
      message: 'Access data seeded successfully',
      seeded: result
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to seed access data',
      error: (err as Error).message
    });
  }
}

export async function getAccessSummary(req: Request, res: Response) {
  const buyerId = req.buyer?.id;
  if (!buyerId) return res.status(400).json({ message: 'Invalid buyer' });

  try {
    const summary = await service.getAccessSummary(buyerId);
    res.json({ 
      success: true, 
      summary 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get access summary',
      error: (err as Error).message
    });
  }
}
