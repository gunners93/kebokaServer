// controllers/paymentController.js
import db from '../config/db.js';
import dusupayService from '../services/dusupayService.js';

// controllers/paymentController.js - Updated initiateDusuPay to pass phone

export const initiateDusuPay = async (req, res) => {
  try {
    const { 
      amount, 
      items, 
      transactionMethod = 'MOBILE_MONEY',
      providerCode = 'MTN',
      phone = '' // Get phone from request
    } = req.body;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📝 INITIATING PAYMENT');
    console.log('========================================');
    console.log('User ID:', userId);
    console.log('Amount:', amount);
    console.log('Transaction Method:', transactionMethod);
    console.log('Provider Code:', providerCode);
    console.log('Phone:', phone);
    console.log('========================================');

    // Validate amount
    if (!amount || amount <= 0) {
      console.log('❌ Invalid amount:', amount);
      return res.status(400).json({
        success: false,
        message: 'Invalid amount',
      });
    }

    // Validate items
    if (!items || !items.length) {
      console.log('❌ No items in cart');
      return res.status(400).json({
        success: false,
        message: 'No items in cart',
      });
    }

    // Validate transaction method
    const validMethods = ['BANK', 'CARD', 'MOBILE_MONEY'];
    if (!validMethods.includes(transactionMethod)) {
      console.log('❌ Invalid transaction method:', transactionMethod);
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction method. Must be BANK, CARD, or MOBILE_MONEY',
      });
    }

    // Validate provider code
    const validProviders = ['MTN', 'AIRTEL', 'GLO', '9MOBILE', 'ETISALAT'];
    if (transactionMethod === 'MOBILE_MONEY' && !validProviders.includes(providerCode.toUpperCase())) {
      console.log('❌ Invalid provider code:', providerCode);
      return res.status(400).json({
        success: false,
        message: 'Invalid provider code. Must be MTN, AIRTEL, GLO, or 9MOBILE',
      });
    }

    // Generate unique reference - ONLY letters and numbers
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `KBK${timestamp}${random}`;
    console.log('📦 Reference:', reference);

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
    console.log('💰 Total Amount:', totalAmount);

    // Create short description (max 30 characters)
    const itemCount = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const description = `KBK: ${itemCount} tickets`;
    const shortDescription = description.substring(0, 30);
    console.log('📝 Description:', shortDescription);

    let orderId = null;

    // Create order in database
    try {
      const [orderResult] = await db.query(
        `INSERT INTO orders (user_id, reference, total_amount, status, items, payment_method, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, reference, totalAmount, 'pending', JSON.stringify(items), 'gbipayments']
      );
      orderId = orderResult.insertId;
      console.log('✅ Order created with ID:', orderId);
    } catch (dbError) {
      console.error('❌ Database Error:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message,
      });
    }

    // Initiate GBiPayments payment
    console.log('🚀 Calling GBiPayments API...');
    const paymentResult = await dusupayService.initiatePayment({
      amount: totalAmount,
      reference: reference,
      description: shortDescription,
      transactionMethod: transactionMethod,
      providerCode: providerCode.toUpperCase(),
      phone: phone, // Pass phone number
    });

    // Check if paymentResult exists
    if (!paymentResult) {
      console.log('❌ No response from GBiPayments');
      if (orderId) {
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE id = ?`,
          [orderId]
        );
      }
      return res.status(500).json({
        success: false,
        message: 'Payment gateway did not respond',
      });
    }

    console.log('📤 GBiPayments Response:', JSON.stringify(paymentResult, null, 2));

    if (!paymentResult.success) {
      console.log('❌ GBiPayments failed:', paymentResult.message);
      if (orderId) {
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE id = ?`,
          [orderId]
        );
      }
      return res.status(400).json({
        success: false,
        message: paymentResult.message || 'Payment initiation failed',
        error: paymentResult.error,
      });
    }

    // Save transaction reference
    if (orderId && paymentResult.transaction_id) {
      await db.query(
        `UPDATE orders SET transaction_id = ? WHERE id = ?`,
        [paymentResult.transaction_id, orderId]
      );
    }

    console.log('✅ Payment initiated successfully!');
    console.log('🔗 Checkout URL:', paymentResult.checkout_url);
    console.log('========================================');

    return res.status(200).json({
      success: true,
      checkout_url: paymentResult.checkout_url,
      reference: reference,
      transaction_id: paymentResult.transaction_id,
      order_id: orderId,
    });

  } catch (error) {
    console.error('❌ Initiate Payment Error:', error);
    console.error('Error Stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Payment initiation failed',
      error: error.message,
    });
  }
};

// Verify payment after redirect
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference required',
      });
    }

    // Verify with GBiPayments
    const verification = await dusupayService.verifyPayment(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed',
      });
    }

    // Update order status in database
    const status = verification.status === 'completed' || verification.status === 'success' ? 'paid' : 'failed';
    
    await db.query(
      `UPDATE orders SET status = ?, payment_data = ? WHERE reference = ?`,
      [status, JSON.stringify(verification.data), reference]
    );

    // If payment is successful, create tickets
    if (status === 'paid') {
      const [order] = await db.query(
        `SELECT * FROM orders WHERE reference = ?`,
        [reference]
      );

      if (order.length) {
        const items = JSON.parse(order[0].items);
        
        // Create tickets for each item
        for (const item of items) {
          for (let i = 0; i < item.quantity; i++) {
            await db.query(
              `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at) 
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [
                order[0].user_id,
                item.competition_id,
                order[0].id,
                `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                'active',
              ]
            );
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      status: status,
      data: verification.data,
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
};

// GBiPayments Webhook Handler
export const handleDusuPayWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📨 Webhook received:', JSON.stringify(payload, null, 2));

    // Handle different webhook events
    const { event, data } = payload;

    switch (event) {
      case 'payment.success':
      case 'payment.completed':
        // Payment successful - create tickets
        const reference = data.merchant_reference || data.reference;
        await db.query(
          `UPDATE orders SET status = 'paid', payment_data = ? WHERE reference = ?`,
          [JSON.stringify(data), reference]
        );
        
        // Create tickets
        const [order] = await db.query(
          `SELECT * FROM orders WHERE reference = ?`,
          [reference]
        );
        
        if (order.length) {
          const items = JSON.parse(order[0].items);
          for (const item of items) {
            for (let i = 0; i < item.quantity; i++) {
              await db.query(
                `INSERT INTO tickets (user_id, competition_id, order_id, ticket_number, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                  order[0].user_id,
                  item.competition_id,
                  order[0].id,
                  `TKT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                  'active',
                ]
              );
            }
          }
        }
        console.log('✅ Payment completed and tickets created for:', reference);
        break;

      case 'payment.failed':
        await db.query(
          `UPDATE orders SET status = 'failed' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log('❌ Payment failed for:', data.merchant_reference || data.reference);
        break;

      case 'payment.pending':
        await db.query(
          `UPDATE orders SET status = 'pending' WHERE reference = ?`,
          [data.merchant_reference || data.reference]
        );
        console.log('⏳ Payment pending for:', data.merchant_reference || data.reference);
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
    });
  }
};

// Payout methods
export const initiatePayout = async (req, res) => {
  try {
    const { 
      amount, 
      email, 
      phone, 
      name, 
      bank_code, 
      account_number, 
      account_name,
      reason 
    } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can initiate payouts',
      });
    }

    // Validate required fields
    if (!amount || !email || !bank_code || !account_number || !account_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, email, bank_code, account_number, account_name',
      });
    }

    // Generate unique reference - only letters and numbers
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `PO${timestamp}${random}`;

    // Convert amount to kobo
    const amountInKobo = Math.round(parseFloat(amount) * 100);

    // Initiate payout
    const result = await dusupayService.initiatePayout({
      amount: amountInKobo,
      email: email,
      phone: phone,
      name: name,
      reference: reference,
      bank_code: bank_code,
      account_number: account_number,
      account_name: account_name,
      narration: reason || 'Payout from Keboka',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Payout initiation failed',
      });
    }

    // Save payout record in database
    await db.query(
      `INSERT INTO payouts (user_id, reference, amount, bank_code, account_number, account_name, status, payout_data, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        reference,
        amount,
        bank_code,
        account_number,
        account_name,
        'pending',
        JSON.stringify(result.data),
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Payout initiated successfully',
      data: result.data,
      reference: reference,
    });

  } catch (error) {
    console.error('❌ Initiate Payout Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payout initiation failed',
      error: error.message,
    });
  }
};

// Verify payout status
export const verifyPayout = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference required',
      });
    }

    // Get payout from database
    const [payout] = await db.query(
      `SELECT * FROM payouts WHERE reference = ?`,
      [reference]
    );

    if (!payout.length) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    // Verify with GBiPayments
    const verification = await dusupayService.verifyPayment(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payout verification failed',
      });
    }

    // Update payout status
    await db.query(
      `UPDATE payouts SET status = ?, payout_data = ? WHERE reference = ?`,
      [verification.status, JSON.stringify(verification.data), reference]
    );

    return res.status(200).json({
      success: true,
      data: verification.data,
      status: verification.status,
    });

  } catch (error) {
    console.error('❌ Verify Payout Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payout verification failed',
    });
  }
};

// Handle payout webhook
export const handlePayoutWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📨 Payout Webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    switch (event) {
      case 'payout.completed':
        await db.query(
          `UPDATE payouts SET status = 'completed', payout_data = ? WHERE reference = ?`,
          [JSON.stringify(data), data.reference]
        );
        console.log(`✅ Payout ${data.reference} completed successfully`);
        break;

      case 'payout.failed':
        await db.query(
          `UPDATE payouts SET status = 'failed', payout_data = ? WHERE reference = ?`,
          [JSON.stringify(data), data.reference]
        );
        console.log(`❌ Payout ${data.reference} failed`);
        break;

      case 'payout.pending':
        await db.query(
          `UPDATE payouts SET status = 'pending', payout_data = ? WHERE reference = ?`,
          [JSON.stringify(data), data.reference]
        );
        console.log(`⏳ Payout ${data.reference} is pending`);
        break;

      default:
        console.log(`Unhandled payout webhook event: ${event}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Payout webhook processed successfully',
    });

  } catch (error) {
    console.error('❌ Payout Webhook Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payout webhook processing failed',
    });
  }
};

// Get transaction status
export const getTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID required',
      });
    }

    const result = await dusupayService.getTransaction(transactionId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to get transaction',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('❌ Get Transaction Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction status',
    });
  }
};