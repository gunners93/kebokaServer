import express from 'express';
import { registerUser, loginUser,getMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from "../middleware/upload.js";

import { getPrizeDetails,getCompetitionById,getCompetitions_web,getcompetitionstype_web } from '../controllers/webController.js';
const router = express.Router();

//getcompetitionstype_web
router.get('/competitions/:type', getcompetitionstype_web );



router.get('/text', (req, res, next) =>  {
  res.send('Hello World');
});




export default router;