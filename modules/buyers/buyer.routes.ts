import { Router } from "express";
import * as dao from "./buyer.dao";
import * as controller from "./buyer.controller";
import multer from "multer";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// router.get('/', async (req, res) => { const limit = Number(req.query.limit ?? 100); const offset = Number(req.query.offset ?? 0); res.json(await dao.list(limit, offset)); });
router.get("/name/:mobile", async (req, res) => {
  const mobile = req.params.mobile;
  const item = await dao.getNameByMobile(mobile);
  if (!item) return res.status(404).json({ message: "Buyer not found" });
  res.json(item);
});
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await dao.getById(id);
  if (!item) return res.status(404).json({ message: "Buyer not found" });
  res.json(item);
});

// Image upload endpoint
router.post("/:id/upload-images", 
  upload.fields([
    { name: 'pan_image', maxCount: 1 },
    { name: 'aadhaar_front_image', maxCount: 1 },
    { name: 'aadhaar_back_image', maxCount: 1 }
  ]),
  controller.uploadImages
);

// router.post('/', async (req, res) => { const id = await dao.create(req.body); res.status(201).json({ buyer_id: id }); });
// router.put('/:id', async (req, res) => { const id = Number(req.params.id); const ok = await dao.update(id, req.body); if (!ok) return res.status(404).json({ message: 'Buyer not found' }); res.status(204).send(); });
export default router;
