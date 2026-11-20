// controllers/tickets.js
import db from "../config/db.js";
import { sendTicketsEmail } from "../services/email.service.js";

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
    const allGeneratedTickets = [];

    // 2️⃣ Process each competition purchase
    for (const item of tickets) {
      const { ticket_id, quantity, price, type } = item;

      // 🔒 Lock competition row to prevent overselling
      const [rows] = await connection.query(
        `SELECT id, title, total_participants, tickets_sold
         FROM competitions WHERE id = ? FOR UPDATE`,
        [ticket_id]
      );

      if (rows.length === 0) throw new Error(`Competition ${ticket_id} not found`);
      const competition = rows[0];

      // ✅ CHECK IF SOLD OUT
      if (competition.tickets_sold >= competition.total_participants) {
        throw new Error(`Sorry, "${competition.title}" is completely SOLD OUT.`);
      }

      // ✅ PREVENT OVERSELLING
      if (competition.tickets_sold + quantity > competition.total_participants) {
        const remaining = competition.total_participants - competition.tickets_sold;
        throw new Error(`Only ${remaining} ticket(s) remaining for "${competition.title}".`);
      }

      const ticketRows = [];
      const currentSold = competition.tickets_sold;
      const cleanType = (type || "Ticket").replace(/\s+/g, "");

      for (let i = 1; i <= quantity; i++) {
        const nextNumber = currentSold + i;
        const ticketNumber = `KBK-${cleanType}-${String(nextNumber).padStart(6, "0")}`;
        
        // ✅ Push data for the tickets table
        ticketRows.push([userId, ticket_id, ticketNumber, price, orderId, 'active']);
        
        // ✅ Track for the email
        allGeneratedTickets.push({
          ticket_id,
          ticket_number: ticketNumber, // Added for email compatibility
          ticketNumber,
          competitionTitle: competition.title,
        });
      }

      // ✅ FIXED: Insert into `tickets` table (not user_tickets) so MyCompetitions works
      await connection.query(
        `INSERT INTO tickets
         (user_id, competition_id, ticket_number, price, order_id, status)
         VALUES ?`,
        [ticketRows]
      );

      // Update competition sold count
      await connection.query(
        `UPDATE competitions SET tickets_sold = tickets_sold + ? WHERE id = ?`,
        [quantity, ticket_id]
      );
    }

    await connection.commit();

    // 3️⃣ Fetch user + send tickets email (non-blocking failure)
    try {
      const [u] = await db.query(
        "SELECT name, email FROM users WHERE id = ?",
        [userId]
      );
      if (u.length) {
        await sendTicketsEmail(u[0].email, u[0].name, allGeneratedTickets, reference);
      }
    } catch (emailErr) {
      console.error("⚠️ Tickets email failed:", emailErr.message);
    }

    return res.json({
      success: true,
      message: "Purchase completed successfully",
      tickets: allGeneratedTickets,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
};