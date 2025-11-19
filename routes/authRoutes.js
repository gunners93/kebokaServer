import express from 'express';
import { registerUser, loginUser,getMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from "../middleware/upload.js";
import { createCompetition,getProcurements ,createProcurement, updateProcurement, deleteProcurement,getCompetitions,getCompetitionTypes} from '../controllers/adminController.js';
import { getPrizeDetails,getCompetitionById,getCompetitions_web,getcompetitionstype_web } from '../controllers/webController.js';
const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.get("/me", verifyToken, getMe);
// Example protected route
router.get('/profile', verifyToken, (req, res) => {
  res.json({ message: `Welcome ${req.user.email}`, user: req.user });
});


//text routes
router.get('/text', (req, res, next) =>  {
  res.send('Hello World');
});


///admin routes
router.get('/procurements', getProcurements);
// router.post('/procurements', createProcurement);

router.post("/procurements", upload.array("images", 10), createProcurement);

router.put('/procurements/:id', updateProcurement);
router.delete('/procurements/:id', deleteProcurement);

router.get('/competitiontypes', getCompetitionTypes);
 router.get('/competitions', getCompetitions);
router.post('/competitions',createCompetition)


//web routes
router.get('/competitions/:type', );
router.get('/prizes/:id', getPrizeDetails);
router.get('/competitions/:id', getCompetitionById);

router.get('/competitions_web', getCompetitionsWeb);




export default router;
