import { Request, Response } from 'express';
import * as dao from './buyer.dao';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/config';

// Helper function to ensure directory exists
const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Helper function to get file extension
const getExt = (originalName: string, mimeType: string): string => {
  const guessed = originalName && path.extname(originalName).replace('.', '').toLowerCase();
  if (guessed) return guessed;
  if (!mimeType) return 'jpg';
  const map: { [key: string]: string } = { 
    'image/jpeg': 'jpg', 
    'image/jpg': 'jpg', 
    'image/png': 'png', 
    'image/webp': 'webp' 
  };
  return map[mimeType] || 'jpg';
};

// Helper function to handle document upload
const handleDoc = async (file: Express.Multer.File | undefined, folder: string, buyerId: number): Promise<number | null> => {
  try {
    if (!file) return null;
    
    // Always use resolved static path from config; inside Docker this is /app/data-files
    // which is bind-mounted to host /home/ubuntu/indus/data_files
    const baseDir = config.static.dataFilesPath;
    const buyerDirName = process.env.DIR_BUYER || 'buyer';
    
    if (!baseDir) {
      console.warn(`Base data dir not set; skipping save for ${folder}`);
      return null;
    }
    
    const ext = getExt(file.originalname, file.mimetype);
    const docImageId = await dao.insertBuyerDocImage(ext);
    const dir = path.join(baseDir, buyerDirName, String(buyerId), folder);
    ensureDir(dir);
    const filePath = path.join(dir, `${docImageId}.${ext}`);
    
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      console.warn(`File buffer missing for ${folder}; skipping save`);
      return null;
    }
    
    await fs.promises.writeFile(filePath, file.buffer);
    return docImageId;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error(`Failed handling ${folder} doc for buyer ${buyerId}: ${errorMessage}`);
    return null;
  }
};

export const uploadImages = async (req: Request, res: Response) => {
  const buyerId = Number(req.params.id);
  const files = (req as any).files || {};
  
  console.log(`uploadImages() received file fields: ${Object.keys(files).join(', ')}`);
  console.log(`uploadImages() files object:`, files);
  console.log(`uploadImages() req.body:`, req.body);
  
  const panFile = files.pan_image && files.pan_image[0];
  const aadhaarFrontFile = files.aadhaar_front_image && files.aadhaar_front_image[0];
  const aadhaarBackFile = files.aadhaar_back_image && files.aadhaar_back_image[0];
  
  console.log(`uploadImages() file processing: pan=${!!panFile}, aadhaarFront=${!!aadhaarFrontFile}, aadhaarBack=${!!aadhaarBackFile}`);
  if (panFile) console.log(`PAN file details:`, { originalname: panFile.originalname, mimetype: panFile.mimetype, size: panFile.size });
  if (aadhaarFrontFile) console.log(`Aadhaar front file details:`, { originalname: aadhaarFrontFile.originalname, mimetype: aadhaarFrontFile.mimetype, size: aadhaarFrontFile.size });
  if (aadhaarBackFile) console.log(`Aadhaar back file details:`, { originalname: aadhaarBackFile.originalname, mimetype: aadhaarBackFile.mimetype, size: aadhaarBackFile.size });

  try {
    let panDocId = null;
    let aadhaarFrontDocId = null;
    let aadhaarBackDocId = null;

    // Process each image type
    panDocId = await handleDoc(panFile, 'PAN', buyerId);
    aadhaarFrontDocId = await handleDoc(aadhaarFrontFile, 'ADHAAR_FRONT', buyerId);
    aadhaarBackDocId = await handleDoc(aadhaarBackFile, 'ADHAAR_BACK', buyerId);

    // Update buyer with document IDs if any were processed
    if (panDocId || aadhaarFrontDocId || aadhaarBackDocId) {
      await dao.updateBuyerDocIds(buyerId, {
        panDocId,
        aadhaarFrontDocId,
        aadhaarBackDocId
      });
      console.log(`Updated buyer ${buyerId} with doc IDs: pan=${panDocId}, aadhaarFront=${aadhaarFrontDocId}, aadhaarBack=${aadhaarBackDocId}`);
    }

    res.json({ 
      message: 'Images uploaded successfully', 
      pan_doc_id: panDocId, 
      aadhaar_front_doc_id: aadhaarFrontDocId, 
      aadhaar_back_doc_id: aadhaarBackDocId 
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Image upload failed for buyer ${buyerId}: ${errorMessage}`);
    res.status(500).json({ message: 'Image upload failed' });
  }
};
