// controllers/tickets.js
// ❌ REMOVE THIS LINE - it's for frontend only
// import { ExternalLinkIcon } from "lucide-react";

import db from "../config/db.js";

export const purchaseTickets = async (req, res) => {
  let connection;
  connection = await db.getConnection();

  try {
    const userId = req.user.id;
    const { reference, amount, tickets } = req.body;

    if (!tickets || tickets.length === 0) {
      return res.status(400).json({ message: "No tickets found in order" });
    }

    await connection.beginTransaction();

    // 1️⃣ Create Order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, reference, amount, status)
       VALUES (?, ?, ?, 'paid')`,
      [userId, reference, amount]
    );

    const orderId = orderResult.insertId;
    let allGeneratedTickets = [];

    // 2️⃣ Process each competition purchase
    for (const item of tickets) {
      const { ticket_id, quantity, price, type } = item;

      // 🔒 Lock competition row to prevent overselling
      const [rows] = await connection.query(
        `SELECT id, total_participants, tickets_sold 
         FROM competitions WHERE id = ? FOR UPDATE`,
        [ticket_id]
      );

      if (rows.length === 0) throw new Error(`Competition ${ticket_id} not found`);

      const competition = rows[0];

      if (competition.tickets_sold + quantity > competition.total_participants) {
        throw new Error(`Not enough tickets remaining for competition: ${ticket_id}`);
      }

      // 🎟️ Prepare ticket data for batch insert
      const ticketRows = [];
      let currentSold = competition.tickets_sold;
      const cleanType = (type || "Ticket").replace(/\s+/g, '');
      
      for (let i = 1; i <= quantity; i++) {
        const nextNumber = currentSold + i;
        const ticketNumber = `KBK-${cleanType}-${String(nextNumber).padStart(6, '0')}`;
        ticketRows.push([userId, ticket_id, ticketNumber, price, orderId]);
        allGeneratedTickets.push({ ticket_id, ticketNumber });
      }

      // ⚡ Batch Insert
      await connection.query(
        `INSERT INTO user_tickets 
         (user_id, competition_id, ticket_number, price, order_id)
         VALUES ?`,
        [ticketRows]
      );

      // 🔄 Update tickets sold count
      await connection.query(
        `UPDATE competitions SET tickets_sold = tickets_sold + ? WHERE id = ?`,
        [quantity, ticket_id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Purchase completed successfully",
      tickets: allGeneratedTickets
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
};