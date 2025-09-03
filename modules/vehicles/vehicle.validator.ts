import { Request, Response, NextFunction } from 'express';

export function validateCreate(req: Request, res: Response, next: NextFunction) {
  const required = ['vehicle_make_id','vehicle_model_id','vehicle_variant_id','seller_id','business_vertical'];
  for (const key of required) {
    if (req.body[key] === undefined) {
      return res.status(400).json({ message: `Missing field: ${key}` });
    }
  }
  next();
}


