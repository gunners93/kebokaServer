import express from 'express';
import { registerUser, loginUser,getMe,userProfileUpdate } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from "../middleware/upload.js";
import { createCompetition,getProcurements ,createProcurement, updateProcurement, deleteProcurement,getCompetitions,getCompetitionTypes} from '../controllers/adminController.js';
import { getPrizeDetails,getCompetitionById,getCompetitions_web,getcompetitionstype_web } from '../controllers/webController.js';
import {sendForgotPasswordEmail,resetPassword} from '../controllers/emailUtility.js';
const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.get("/me", verifyToken, getMe);

router.put("/userProfileUpdate", verifyToken, userProfileUpdate);

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

router.get('/competitions_web', getCompetitions_web);


// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await sendForgotPasswordEmail(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error sending reset link' });
  }
});
// reset-password
// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  try {
    const result = await resetPassword(token, newPassword);
    res.json(result); // { message: 'Password successfully updated.' }
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to reset password' });
  }
});
export default router;
