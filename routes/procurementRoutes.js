// routes/procurementRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as procurementController from '../controllers/procurementController.js';

const router = express.Router();

// ============================================
// MULTER CONFIGURATION
// ============================================

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `procurement-${uniqueSuffix}${ext}`);
  },
});

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ============================================
// CATEGORIES & SUBCATEGORIES
// ============================================
router.get('/categories', procurementController.getCategories);
router.get('/subcategories/:categoryId', procurementController.getSubcategories);

// ============================================
// STATS
// ============================================
router.get('/stats', verifyToken, procurementController.getProcurementStats);

// ============================================
// PROCUREMENTS
// ============================================
router.get('/procurements', procurementController.getProcurements);
router.get('/:id', procurementController.getProcurement);

// ✅ ADD upload.array('images') for create and update
router.post(
  '/procurements', 
  verifyToken, 
  upload.array('images', 10), // Max 10 images
  procurementController.createProcurement
);

router.put(
  '/:id', 
  verifyToken, 
  upload.array('images', 10),
  procurementController.updateProcurement
);

router.delete('/:id', verifyToken, procurementController.deleteProcurement);

export default router;