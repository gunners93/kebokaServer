import express from 'express';
import { registerUser, loginUser,getMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from "../middleware/upload.js";

import { getStates,getLgasByState,getSchools,getcompetitionstype_web,getCompetitionTypes_web,getCompetitions_web } from '../controllers/webController.js';
const router = express.Router();

//getcompetitionstype_web
router.get('/competitions/:type', getcompetitionstype_web );

router.get('/competitions_web', getCompetitions_web);
router.get('/competitiontypes_web', getCompetitionTypes_web);
router.get('/competitionstype/:type', getcompetitionstype_web);
router.get('/text2', (req, res, next) =>  {
  res.send('Hello World2');
});

router.get('/states', getStates);
router.get('/lgas/:stateId', getLgasByState);
router.get('/schools', getSchools);


export default router;