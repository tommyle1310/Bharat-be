import { Request, Response } from 'express';
import * as service from './case.service';
export async function list(req: Request, res: Response) {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const data = await service.list({limit, offset});
    res.json(data);
  }