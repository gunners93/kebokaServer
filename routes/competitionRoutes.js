// routes/competitionRoutes.js
import express from 'express';
import * as competitionController from '../controllers/competitionController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Competition types
router.get('/competitiontypes', competitionController.getCompetitionTypes);

// Competitions - Public
router.get('/competitions', competitionController.getCompetitions);
router.get('/competitions/:id', competitionController.getCompetition);
router.get('/:id/full-details', competitionController.getCompetitionFullDetails);

// Competitions - Protected (Admin)
router.post(
  '/competitions',
  verifyToken,
  competitionController.uploadMiddleware,
  competitionController.createCompetition
);

router.put(
  '/competitions/:id',
  verifyToken,
  competitionController.uploadMiddleware,
  competitionController.updateCompetition
);

router.delete('/competitions/:id', verifyToken, competitionController.deleteCompetition);
router.post('/competitions/:id/draw', verifyToken, competitionController.drawCompetitionWinner);

export default router;