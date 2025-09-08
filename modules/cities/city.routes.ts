import { Router } from 'express';
import * as dao from './city.dao';

const router = Router();
router.get('/state/:stateId', async (req, res) => res.json(await dao.listByState(Number(req.params.stateId))));
router.get('/', async (req, res) => res.json(await dao.list()));
router.post('/', async (req, res) => { const id = await dao.create(req.body); res.status(201).json({ city_id: id }); });
export default router;


