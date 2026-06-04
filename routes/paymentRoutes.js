import express from 'express';
const router = express.Router();
// import { initiateDusuPay, handleDusuPayWebhook } from '../controllers/paymentController.js';
// import { verifyToken } from '../middleware/authMiddleware.js';

// Route for User to start payment (Needs Login)
// router.post('/initiate-dusupay', verifyToken, initiateDusuPay);

// Route for DusuPay to confirm payment (PUBLIC - No Middleware)
// router.get('/dusupay/collection-webhook', handleDusuPayWebhook);


export default router;