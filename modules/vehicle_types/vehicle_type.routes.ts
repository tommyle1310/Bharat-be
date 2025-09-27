import { Router } from 'express';
import * as dao from './vehicle_type.dao';

const router = Router();
router.get('/', async (req, res) => { const limit = Number(req.query.limit ?? 100); const offset = Number(req.query.offset ?? 0); res.json(await dao.list(limit, offset)); });
router.post('/', async (req, res) => { const id = await dao.create(req.body); res.status(201).json({ staff_id: id }); });
export default router;


