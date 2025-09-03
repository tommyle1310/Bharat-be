import { Request, Response } from 'express';
import * as dao from './fuel.dao';

export async function list(_req: Request, res: Response) {
  res.json(await dao.list());
}

export async function upsert(req: Request, res: Response) {
  await dao.upsert(req.body);
  res.status(204).send();
}


