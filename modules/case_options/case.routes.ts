import { Router } from 'express';
import * as dao from './case.dao';

const router = Router();
router.get('/', async (_req, res) => res.json(await dao.list({limit: 100, offset: 0})));
router.put('/', async (req, res) => { await dao.upsert(req.body); res.status(204).send(); });
export default router;


