import { Router } from 'express';
import * as dao from './buyer.dao';

const router = Router();
router.get('/', async (req, res) => { const limit = Number(req.query.limit ?? 100); const offset = Number(req.query.offset ?? 0); res.json(await dao.list(limit, offset)); });
router.get('/:id', async (req, res) => { const id = Number(req.params.id); const item = await dao.getById(id); if (!item) return res.status(404).json({ message: 'Buyer not found' }); res.json(item); });
router.post('/', async (req, res) => { const id = await dao.create(req.body); res.status(201).json({ buyer_id: id }); });
router.put('/:id', async (req, res) => { const id = Number(req.params.id); const ok = await dao.update(id, req.body); if (!ok) return res.status(404).json({ message: 'Buyer not found' }); res.status(204).send(); });
export default router;


