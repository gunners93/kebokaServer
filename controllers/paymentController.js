// controllers/paymentController.js
import db from '../config/db.js';
import gbipaymentsService from '../services/gbipayments.service.js';

// controllers/paymentController.js
// Look for the part where you create the order - it should be BEFORE calling GBiPayments

export const initiateDusuPay = async (req, res) => {
  try {
    const { 
      amount, 
      items, 
      customer_name,
      customer_email
    } = req.body;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📝 INITIATING PAYMENT');
    console.log('========================================');

    // ... validation code ...

    // Generate merchant reference FIRST
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const merchantReference = `KBK${timestamp}${random}`;
    console.log(`📦 Merchant Reference: ${merchantReference}`);

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);

    // Create description
    const itemCount = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const description = `KBK: ${itemCount} tickets`;
    const shortDescription = description.substring(0, 30);

    // ✅ STEP 1: Create order in database FIRST
    let orderId = null;
    try {
      const [orderResult] = await db.query(
        `INSERT INTO orders (user_id, reference, total_amount, status, items, payment_method, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, merchantReference, totalAmount, 'pending', JSON.stringify(items), 'gbipayments']
      );
      orderId = orderResult.insertId;
      console.log(`✅ Order created with ID: ${orderId}, Reference: ${merchantReference}`);
    } catch (dbError) {
      console.error('❌ Database Error:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message,
      });
    }

    // Build the payment payload
    const payload = {
      amount: totalAmount,
      currency: 'NGN',
      merchantReference: merchantReference,
      description: shortDescription,
      callbackUrl: process.env.DUSUPAY_WEBHOOK_URL || 'https://collector-smokiness-underwent.ngrok-free.dev/api/pay/webhook',
      customerName: customer_name || 'Customer',
    };

    if (customer_email) payload.customerEmail = customer_email;

    console.log('🚀 Sending BANK payment request to GBiPayments...');
    const paymentResult = await gbipaymentsService.initializePayment(payload);

    console.log('📤 GBiPayments Response:', JSON.stringify(paymentResult, null, 2));

    if (!paymentResult.success) {
      console.log('❌ Payment initiation failed:', paymentResult.message);
      
      // Update order status to failed
      if (orderId) {
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE id = ?`,
          [orderId]
        );
      }

      return res.status(paymentResult.statusCode || 400).json({
        success: false,
        message: paymentResult.message || 'Payment initiation failed',
        error: paymentResult.error,
      });
    }

    // ✅ STEP 2: Update order with transaction_id (internal_reference)
    if (orderId && paymentResult.internal_reference) {
      await db.query(
        `UPDATE orders SET transaction_id = ? WHERE id = ?`,
        [paymentResult.internal_reference, orderId]
      );
      console.log(`✅ Updated order ${orderId} with transaction_id: ${paymentResult.internal_reference}`);
    }

    console.log('✅ Payment initiated successfully!');
    console.log(`🔗 Checkout URL: ${paymentResult.checkout_url}`);
    console.log(`📦 Merchant Reference: ${merchantReference}`);
    console.log(`📦 Internal Reference: ${paymentResult.internal_reference}`);

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


// ... rest of the functions (verifyPayment, handleDusuPayWebhook, etc.) remain the same

/**
 * Verify payment after redirect
 * GET /api/pay/verify/:reference
 */
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference required',
      });
    }

    console.log(`📤 Verifying payment for reference: ${reference}`);

    const verification = await gbipaymentsService.verifyPayment(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed',
        error: verification.error,
      });
    }

    const status = verification.status === 'completed' || verification.status === 'success' ? 'paid' : 'failed';
    
    await db.query(
      `UPDATE orders SET status = ?, payment_data = ? WHERE reference = ?`,
      [status, JSON.stringify(verification.data), reference]
    );

    if (status === 'paid') {
      const [order] = await db.query(
        `SELECT * FROM orders WHERE reference = ?`,
        [reference]
      );

      if (order.length) {
        const items = JSON.parse(order[0].items);
        
        for (const item of items) {
          for (let i = 0; i < item.quantity; i++) {
            const ticketNumber = `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await db.query(
              `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at) 
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [
                order[0].user_id,
                item.competition_id,
                order[0].id,
                ticketNumber,
                'active',
              ]
            );
          }
        }
        console.log(`✅ Created ${items.reduce((s, i) => s + i.quantity, 0)} tickets for order ${order[0].id}`);
      }
    }

    return res.status(200).json({
      success: true,
      status: status,
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



// controllers/paymentController.js

/**
 * Manual ticket creation for testing (Admin only)
 * POST /api/pay/admin/create-tickets
 */
// controllers/paymentController.js

/**
 * Manual ticket creation for testing (Admin only)
 * POST /api/pay/admin/create-tickets
 */
export const adminCreateTickets = async (req, res) => {
  try {
    // Check if user is admin (optional - remove if testing)
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Only admins can create tickets manually',
    //   });
    // }

    // const  reference  ='KBK1785226207292W3EJJ4';//req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required',
      });
    }

    console.log(`🎫 Creating tickets manually for reference: ${reference}`);

    // Get the order
    const [order] = await db.query(
      `SELECT * FROM orders WHERE reference = ?`,
      [reference]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: `Order with reference: ${reference} not found`,
      });
    }

    console.log(`📦 Order found:`, order[0]);

    // Check if already paid
    if (order[0].status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    // Parse items - handle both string and object
    let items;
    if (typeof order[0].items === 'string') {
      items = JSON.parse(order[0].items);
    } else {
      items = order[0].items; // Already an object
    }

    console.log(`📦 Items:`, items);

    // Update order status
    await db.query(
      `UPDATE orders SET status = 'paid' WHERE id = ?`,
      [order[0].id]
    );

    // Create tickets
    let ticketCount = 0;
    const createdTickets = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity) || 1;
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const [result] = await db.query(
          `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [order[0].user_id, item.competition_id, order[0].id, ticketNumber, 'active']
        );
        createdTickets.push(result.insertId);
        ticketCount++;
      }
    }

    console.log(`✅ Created ${ticketCount} tickets for order ${reference}`);

    return res.status(200).json({
      success: true,
      message: `Created ${ticketCount} tickets for order ${reference}`,
      order_id: order[0].id,
      tickets_created: ticketCount,
      ticket_ids: createdTickets,
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

/**
 * GBiPayments Webhook Handler
 * POST /api/pay/webhook
 */
export const handleDusuPayWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📨 Webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    switch (event) {
      case 'payment.success':
      case 'payment.completed':
        const reference = data.merchant_reference || data.reference;
        await db.query(
          `UPDATE orders SET status = 'paid', payment_data = ? WHERE reference = ?`,
          [JSON.stringify(data), reference]
        );
        
        const [order] = await db.query(
          `SELECT * FROM orders WHERE reference = ?`,
          [reference]
        );
        
        if (order.length) {
          const items = JSON.parse(order[0].items);
          for (const item of items) {
            for (let i = 0; i < item.quantity; i++) {
              const ticketNumber = `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
              await db.query(
                `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                  order[0].user_id,
                  item.competition_id,
                  order[0].id,
                  ticketNumber,
                  'active',
                ]
              );
            }
          }
        }
        console.log(`✅ Payment completed and tickets created for: ${reference}`);
        break;

      case 'payment.failed':
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log(`❌ Payment failed for: ${data.merchant_reference || data.reference}`);
        break;

      case 'payment.pending':
        await db.query(
          `UPDATE orders SET status = 'pending' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log(`⏳ Payment pending for: ${data.merchant_reference || data.reference}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });

  } catch (error) {
    console.error('❌ Webhook Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
    });
  }
};

/**
 * Get payment providers
 * GET /api/pay/providers
 */
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

    return res.status(200).json({
      success: true,
      data: result.providers,
    });

  } catch (error) {
    console.error('❌ Get Payment Providers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment providers',
      error: error.message,
    });
  }
};

/**
 * Confirm a payment
 * POST /api/pay/confirm
 */
export const confirmPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference required',
      });
    }

    const result = await gbipaymentsService.confirmPayment(reference);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to confirm payment',
        error: result.error,
      });
    }

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

/**
 * Abort a payment
 * POST /api/pay/abort
 */
export const abortPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference required',
      });
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