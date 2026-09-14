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
router.get('/tickets/stats', adminController.getTicketStats);
router.get('/tickets/export', adminController.exportTickets);
router.get('/tickets/:id', adminController.getTicketById);
router.put('/tickets/:id/status', adminController.updateTicketStatus);
router.put('/tickets/bulk/status', adminController.bulkUpdateTicketStatus);
router.delete('/tickets/:id', adminController.deleteTicket);

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
// routes/adminRoutes.js — Add to Users section
router.get('/users', adminController.getAllUsers);
router.get('/users/stats', adminController.getUserStats);
router.get('/users/export', adminController.exportUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);




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