// routes/competitionTypeRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as competitionTypeController from '../controllers/competitionTypeController.js';

const router = express.Router();

// Stats (protected)
router.get('/stats', verifyToken, competitionTypeController.getCompetitionTypeStats);

// CRUD
router.get('/', competitionTypeController.getAllCompetitionTypes);
router.get('/:id', competitionTypeController.getCompetitionTypeById);

router.post(
  '/',
  verifyToken,
  competitionTypeController.uploadMiddleware,
  competitionTypeController.createCompetitionType
);

router.put(
  '/:id',
  verifyToken,
  competitionTypeController.uploadMiddleware,
  competitionTypeController.updateCompetitionType
);

router.delete('/:id', verifyToken, competitionTypeController.deleteCompetitionType);

export default router;