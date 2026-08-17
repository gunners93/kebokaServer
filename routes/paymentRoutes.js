// routes/paymentRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as paymentController from '../controllers/paymentController.js';


//router.post('/admin/create-tickets', verifyToken, paymentController.adminCreateTickets);



// router.get("/providers", async (req, res) => {

//     const result = await gbipaymentsService.getPaymentProviders();

//     console.log(JSON.stringify(result, null, 2));

//     res.json(result);

// });
const router = express.Router();


router.post('/admin/create-tickets', paymentController.adminCreateTickets);
// Payment initiation
router.post('/initiate-dusupay', verifyToken, paymentController.initiateDusuPay);

// Payment verification
router.get('/verify/:reference', paymentController.verifyPayment);

// Get payment providers (public)
router.get('/providers', paymentController.getPaymentProviders);

// Webhook (public) - MUST use express.raw for webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleDusuPayWebhook);

// Confirm payment
router.post('/confirm', verifyToken, paymentController.confirmPayment);

// Abort payment
router.post('/abort', verifyToken, paymentController.abortPayment);

export default router;