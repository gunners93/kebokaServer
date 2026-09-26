// controllers/paymentController.js
import db from '../config/db.js';
import gbipaymentsService from '../services/gbipayments.service.js';
import {
  sendOrderInvoice,
  sendPaymentReceipt,
  sendTicketsEmail,
} from '../services/email.service.js';

// ─────────────────────────────────────────────
// Helper: create tickets + send all 3 emails
// (used by verifyPayment AND webhook)
// ─────────────────────────────────────────────
async function finalizePaidOrder(reference) {
  // 1. Fetch order + user
  const [orderRows] = await db.query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE o.reference = ?`,
    [reference]
  );

  if (!orderRows.length) {
    console.log(`⚠️ finalizePaidOrder: order ${reference} not found`);
    return { tickets: [], user: null, items: [] };
  }

  const order = orderRows[0];
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  // 2. Skip if tickets already exist for this order (idempotency)
  const [existing] = await db.query(
    `SELECT COUNT(*) AS count FROM tickets WHERE order_id = ?`,
    [order.id]
  );
  if (existing[0].count > 0) {
    console.log(`ℹ️ Tickets already exist for order ${reference}, skipping creation`);
    return { tickets: [], user: { name: order.user_name, email: order.user_email }, items, alreadyDone: true };
  }

  // 3. Create tickets
  const createdTickets = [];
  for (const item of items) {
    const qty = parseInt(item.quantity) || 1;
    for (let i = 0; i < qty; i++) {
      const ticketNumber = `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const [res] = await db.query(
        `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at)
         VALUES (?, ?, ?, ?, 'active', NOW())`,
        [order.user_id, item.competition_id, order.id, ticketNumber]
      );
      createdTickets.push({
        ticketNumber,
        ticket_id: item.competition_id,
        competitionTitle: item.title || item.type || `Competition #${item.competition_id}`,
      });
    }
  }
  console.log(`✅ Created ${createdTickets.length} tickets for order ${reference}`);

  // 4. Send emails (order invoice, receipt, tickets)
  const user = { name: order.user_name, email: order.user_email };
  const amount = order.total_amount || order.amount;

  try {
    await sendOrderInvoice(user.email, user.name, {
      reference: order.reference,
      amount,
      items,
      status: 'paid',
      createdAt: order.created_at,
    });

    await sendPaymentReceipt(user.email, user.name, {
      reference: order.reference,
      amount,
      method: order.payment_method || 'GBiPayments',
      transactionId: order.transaction_id,
      paidAt: new Date().toLocaleString(),
    });

    await sendTicketsEmail(user.email, user.name, createdTickets, order.reference);
  } catch (emailErr) {
    console.error('⚠️ Emails failed (order still paid):', emailErr.message);
  }

  return { tickets: createdTickets, user, items };
}

// ─────────────────────────────────────────────
// INITIATE PAYMENT
// ─────────────────────────────────────────────
export const initiateDusuPay = async (req, res) => {
  try {
    const { amount, items, customer_name, customer_email } = req.body;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📝 INITIATING PAYMENT');
    console.log('========================================');

    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const merchantReference = `KBK${timestamp}${random}`;
    console.log(`📦 Merchant Reference: ${merchantReference}`);

    const totalAmount = items.reduce(
      (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
      0
    );

    const itemCount = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const description = `KBK: ${itemCount} tickets`;
    const shortDescription = description.substring(0, 30);

    // STEP 1: Create order
    let orderId = null;
    try {
      const [orderResult] = await db.query(
        `INSERT INTO orders (user_id, reference, total_amount, status, items, payment_method, created_at)
         VALUES (?, ?, ?, 'pending', ?, 'gbipayments', NOW())`,
        [userId, merchantReference, totalAmount, JSON.stringify(items)]
      );
      orderId = orderResult.insertId;
      console.log(`✅ Order created ID: ${orderId}, Ref: ${merchantReference}`);
    } catch (dbError) {
      console.error('❌ Database Error:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message,
      });
    }

    // STEP 2: Call payment gateway
    const payload = {
      amount: totalAmount,
      currency: 'NGN',
      merchantReference,
      description: shortDescription,
      callbackUrl:
        process.env.DUSUPAY_WEBHOOK_URL ||
        'https://collector-smokiness-underwent.ngrok-free.dev/api/pay/webhook',
      customerName: customer_name || 'Customer',
    };
    if (customer_email) payload.customerEmail = customer_email;

    console.log('🚀 Sending payment request to GBiPayments...');
    const paymentResult = await gbipaymentsService.initializePayment(payload);
    console.log('📤 GBiPayments Response:', JSON.stringify(paymentResult, null, 2));

    if (!paymentResult.success) {
      if (orderId) {
        await db.query(`UPDATE orders SET status = 'failed' WHERE id = ?`, [orderId]);
      }
      return res.status(paymentResult.statusCode || 400).json({
        success: false,
        message: paymentResult.message || 'Payment initiation failed',
        error: paymentResult.error,
      });
    }

    if (orderId && paymentResult.internal_reference) {
      await db.query(
        `UPDATE orders SET transaction_id = ? WHERE id = ?`,
        [paymentResult.internal_reference, orderId]
      );
    }

    return res.status(200).json({
      success: true,
      reference: merchantReference,
      internal_reference: paymentResult.internal_reference,
      transaction_id: paymentResult.transaction_id,
      order_id: orderId,
      bank_details: paymentResult.transaction_details?.bank_details || null,
      status: 'pending',
    });
  } catch (error) {
    console.error('❌ Initiate Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment initiation failed',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// VERIFY PAYMENT (after redirect)
// ─────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    console.log(`📤 Verifying payment: ${reference}`);
    const verification = await gbipaymentsService.verifyPayment(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed',
        error: verification.error,
      });
    }

    const status =
      verification.status === 'completed' || verification.status === 'success'
        ? 'paid'
        : 'failed';

    await db.query(
      `UPDATE orders SET status = ?, payment_data = ? WHERE reference = ?`,
      [status, JSON.stringify(verification.data), reference]
    );

    if (status === 'paid') {
      await finalizePaidOrder(reference);
    }

    return res.status(200).json({
      success: true,
      status,
      data: verification.data,
    });
  } catch (error) {
    console.error('❌ Verify Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// WEBHOOK
// ─────────────────────────────────────────────
export const handleDusuPayWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📨 Webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    switch (event) {
      case 'payment.success':
      case 'payment.completed': {
        const reference = data.merchant_reference || data.reference;
        await db.query(
          `UPDATE orders SET status = 'paid', payment_data = ? WHERE reference = ?`,
          [JSON.stringify(data), reference]
        );
        await finalizePaidOrder(reference);
        console.log(`✅ Payment completed for: ${reference}`);
        break;
      }
      case 'payment.failed':
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log(`❌ Payment failed: ${data.merchant_reference || data.reference}`);
        break;

      case 'payment.pending':
        await db.query(
          `UPDATE orders SET status = 'pending' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log(`⏳ Payment pending: ${data.merchant_reference || data.reference}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// ADMIN: manually create tickets for an order
// ─────────────────────────────────────────────
export const adminCreateTickets = async (req, res) => {
  try {
    // ✅ FIX: reference was never declared
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    console.log(`🎫 Creating tickets manually for: ${reference}`);

    const [order] = await db.query(`SELECT * FROM orders WHERE reference = ?`, [reference]);
    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: `Order with reference: ${reference} not found`,
      });
    }

    if (order[0].status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    await db.query(`UPDATE orders SET status = 'paid' WHERE id = ?`, [order[0].id]);

    const result = await finalizePaidOrder(reference);

    return res.status(200).json({
      success: true,
      message: `Created ${result.tickets.length} tickets for order ${reference}`,
      order_id: order[0].id,
      tickets_created: result.tickets.length,
      ticket_ids: result.tickets,
    });
  } catch (error) {
    console.error('❌ Admin Create Tickets Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create tickets',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET PROVIDERS
// ─────────────────────────────────────────────
export const getPaymentProviders = async (req, res) => {
  try {
    const result = await gbipaymentsService.getPaymentProviders();
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to get providers',
        error: result.error,
      });
    }
    return res.status(200).json({ success: true, data: result.providers });
  } catch (error) {
    console.error('❌ Get Payment Providers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment providers',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// CONFIRM PAYMENT
// ─────────────────────────────────────────────
export const confirmPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    const result = await gbipaymentsService.confirmPayment(reference);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to confirm payment',
        error: result.error,
      });
    }

    // Also send emails + create tickets if not already
    await finalizePaidOrder(reference);

    return res.status(200).json({
      success: true,
      data: result.data,
      status: result.status,
    });
  } catch (error) {
    console.error('❌ Confirm Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// ABORT PAYMENT
// ─────────────────────────────────────────────
export const abortPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    const result = await gbipaymentsService.abortPayment(reference);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to abort payment',
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      status: result.status,
    });
  } catch (error) {
    console.error('❌ Abort Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to abort payment',
      error: error.message,
    });
  }
};