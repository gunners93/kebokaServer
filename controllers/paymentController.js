
// import axios from 'axios';
// import db from "../config/db.js";

// export const initiateDusuPay = async (req, res) => {
//   const { amount, email, phone, items } = req.body;
  
//   // Safety check for user ID (ensure your auth middleware is working)
//   const userId = req.user?.id; 
//   if (!userId) return res.status(401).json({ message: "User not authenticated" });

//   const merchant_reference = `KBK-${Date.now()}`;

//   try {
//     // 1. Prepare Payload
//     const dusupayPayload = {
//       api_key: process.env.DUSUPAY_API_KEY,
//       currency: "NGN",
//       amount: Number(amount), // Ensure this is a number
//       merchant_reference: merchant_reference,
//  test_mode: process.env.DUSUPAY_TEST_MODE === 'true',
//       // Use your ngrok URL here during local testing!
//    redirect_url: "http://localhost:3000/checkout?status=success", // Local React URL
//   cancel_url: "http://localhost:3000/checkout?status=failed",
//       customer_email: email,
//       customer_phone: phone,
//     };

//     // 2. Save to DB (Crucial step)
//     await db.query(
//       `INSERT INTO transactions 
//       (reference, user_id, amount, status, metadata) 
//       VALUES (?, ?, ?, 'Pending', ?)`,
//       [merchant_reference, userId, amount, JSON.stringify(items)]
//     );
// let response;
//     try {
//       /* UNCOMMENT THIS ONCE DUSUPAY IS BACK UP
//       response = await axios.post(
//         "https://api.dusupay.com/v1/collections", 
//         dusupayPayload,
//         { timeout: 15000 }
//       );
//       */

//       // MOCK DATA: Simulating a successful response from DusuPay
//       response = {
//         data: {
//           data: {
//             checkout_url: `http://localhost:3000/checkout?status=success&ref=${merchant_reference}`
//           }
//         }
//       };

//       // Since we are mocking, we just send the mock URL back
//       return res.json({ 
//         success: true, 
//         checkout_url: response.data.data.checkout_url 
//       });
//     // 3. Request from DusuPay with a Timeout
//     // const response = await axios.post(
//     //   "https://api.dusupay.com/v1/collections", 
//     //   dusupayPayload,
//     //   { timeout: 15000 } // 15 second timeout to prevent hanging on 522 errors
//     // );

//     // DusuPay usually returns data inside a 'data' object
//     // if (response.data && response.data.data && response.data.data.checkout_url) {
//     //   res.json({ 
//     //     success: true, 
//     //     checkout_url: response.data.data.checkout_url 
//     //   });
//     // } else {
//     //   console.log("Unexpected DusuPay Response:", response.data);
//     //   res.status(400).json({ message: "Gateway error: Checkout URL not found" });
//     // }

//  } catch (err) {
//     console.error("--- DusuPay Connection Error ---");
//     // If it's a 522, err.response might be the HTML page you saw
//     if (err.code === 'ECONNABORTED') {
//         console.log("Error: DusuPay took too long to respond (Timeout).");
//     }
    
//     console.log("Status:", err.response?.status);
//     console.log("Message:", err.message);

//     res.status(500).json({ 
//         message: "Payment gateway is currently unreachable. Please try again in 5 minutes.",
//         error: err.message
//     });
// }



// export const handleDusuPayWebhook = async (req, res) => {
//   // DusuPay sends data in the request body
//   const { transaction_status, merchant_reference, internal_reference, amount } = req.body;

//   console.log(`[DusuPay Webhook] Reference: ${merchant_reference} | Status: ${transaction_status}`);

//   // 1. Security Check: Only process if status is COMPLETED
//   if (transaction_status !== 'COMPLETED') {
//     return res.status(200).send("Status is not completed, no action taken.");
//   }

//   try {
//     // 2. Find the Pending Transaction in your database
//     const [rows] = await db.query(
//       "SELECT * FROM transactions WHERE reference = ? AND status = 'Pending' LIMIT 1",
//       [merchant_reference]
//     );

//     if (rows.length === 0) {
//       console.error(`[Webhook Error] No pending transaction found for ref: ${merchant_reference}`);
//       return res.status(200).send("Transaction not found or already processed.");
//     }

//     const transaction = rows[0];
//     const cartItems = JSON.parse(transaction.metadata); // Retrieve the competition items

//     // 3. Update Transaction Status to 'Completed'
//     await db.query(
//       "UPDATE transactions SET status = 'Completed', gateway_ref = ? WHERE id = ?",
//       [internal_reference, transaction.id]
//     );

//     // 4. Generate the Tickets for each item in the cart
//     for (const item of cartItems) {
//       // Loop based on quantity (if user bought 5 tickets for one competition)
//       for (let i = 0; i < item.quantity; i++) {
//         const ticketNumber = `KBK-${Math.floor(100000 + Math.random() * 900000)}`;
        
//         await db.query(
//           `INSERT INTO tickets (user_id, competition_id, ticket_number, purchase_price) 
//            VALUES (?, ?, ?, ?)`,
//           [transaction.user_id, item.competition_id, ticketNumber, item.price]
//         );
//       }
//     }

//     console.log(`[Success] Tickets issued for user ${transaction.user_id} for order ${merchant_reference}`);
    
//     // 5. Tell DusuPay you received it (MUST send 200 OK)
//     res.status(200).send("OK");

//   } catch (err) {
//     console.error("[Webhook Database Error]:", err);
//     // Even if it fails, send 200 so DusuPay doesn't spam your server
//     res.status(200).send("Error occurred but webhook acknowledged");
//   }
// };