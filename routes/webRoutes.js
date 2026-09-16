import express from 'express';
import { registerUser, loginUser,getMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from "../middleware/upload.js";

import {getPopularCompetitions_web,getEndingSoonCompetitions_web,getLiveDraws,getLiveDrawById,getPublicWinners,getCompetitionTypeBySlug, getStates,getLgasByState,getSchools,getcompetitionstype_web,getCompetitionTypes_web,getCompetitions_web } from '../controllers/webController.js';
const router = express.Router();

//getcompetitionstype_web
router.get('/competitions/:type', getcompetitionstype_web );

router.get('/competitions_web', getCompetitions_web);
router.get('/competitiontypes_web', getCompetitionTypes_web);
router.get('/competitionstype/:type', getcompetitionstype_web);

router.get('/winners', getPublicWinners);

router.get('/live-draws', getLiveDraws);
router.get('/live-draws/:id', getLiveDrawById)

router.get('/popular_web', getPopularCompetitions_web);
router.get('/endingsoon_web', getEndingSoonCompetitions_web);
// ✅ Single competition type by slug (must be BEFORE /:type param route)
router.get('/competitiontype/:type', getCompetitionTypeBySlug);




router.get('/text2', (req, res, next) =>  {
  res.send('Hello World2');
});

router.get('/states', getStates);
router.get('/lgas/:stateId', getLgasByState);
router.get('/schools', getSchools);


export default router;