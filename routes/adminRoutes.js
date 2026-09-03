// routes/adminRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// ============================================
// AUTHENTICATION - PUBLIC (No token required)
// ============================================
router.post('/login', adminController.adminLogin);

// ============================================
// All routes below require admin authentication
// ============================================
router.use(verifyToken);

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/dashboard/stats', adminController.getDashboardStats);

// ============================================
// ORDERS MANAGEMENT
// ============================================
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:reference', adminController.getOrderByReference);
router.put('/orders/:reference/status', adminController.updateOrderStatus);
router.post('/orders/create-tickets', adminController.adminCreateTickets);

// ============================================
// TICKETS MANAGEMENT
// ============================================
router.get('/tickets', adminController.getAllTickets);
router.put('/tickets/:id/status', adminController.updateTicketStatus);

// ============================================
// WINNERS MANAGEMENT
// ============================================
router.get('/winners', adminController.getAllWinners);
router.post('/winners/declare', adminController.declareWinner);
router.post('/winners/:id/pay', adminController.payWinner);

// ============================================
// PAYOUTS MANAGEMENT
// ============================================
router.get('/payouts', adminController.getAllPayouts);
router.post('/payouts', adminController.createPayout);
router.post('/payouts/:id/process', adminController.processPayout);

// ============================================
// REPORTS
// ============================================
router.get('/reports/sales', adminController.getSalesReport);
router.get('/reports/competitions', adminController.getCompetitionReport);

// ============================================
// SCHEDULE MANAGEMENT
// ============================================
router.get('/schedule', adminController.getSchedule);
router.post('/schedule', adminController.createCompetition);
router.put('/schedule/:id', adminController.updateCompetition);
router.delete('/schedule/:id', adminController.deleteCompetition);

// ============================================
// USERS (Settings)
// ============================================
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);

// ============================================
// PROCUREMENTS (if needed for admin)
// ============================================
router.get('/procurements', adminController.getProcurements);
router.post('/procurements', adminController.createProcurement);
router.put('/procurements/:id', adminController.updateProcurement);
router.delete('/procurements/:id', adminController.deleteProcurement);

// ============================================
// COMPETITION TYPES
// ============================================
router.get('/competition-types', adminController.getCompetitionTypes);

// ============================================
// COMPETITIONS
// ============================================
router.get('/competitions', adminController.getCompetitions);
router.post('/competitions', adminController.createCompetition);
router.put('/competitions/:id', adminController.updateCompetition);
router.delete('/competitions/:id', adminController.deleteCompetition);
router.get('/competitions/:id/details', adminController.getCompetitionFullDetails);
router.post('/competitions/:id/draw', adminController.drawCompetitionWinner);

export default router;