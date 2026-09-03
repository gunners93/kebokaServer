// controllers/adminController.js
import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ============================================
// AUTHENTICATION
// ============================================

export const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM adminlog WHERE username = ?", [username]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid Admin" });
    }

    const admin = rows[0];

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, role: 'admin' }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        Id: admin.id,
        name: admin.full_name || "Administrator",
        username: admin.username,
        role: "admin"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// PROCUREMENTS
// ============================================

export const getProcurements = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM procurements ORDER BY id DESC");
    const data = rows.map((item) => ({
      ...item,
      images: item.images ? JSON.parse(item.images) : [],
    }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const createProcurement = async (req, res) => {
  const { type, title, description, brand, model, year, location, price } = req.body;
  const imageFiles = req.files ? req.files.map((f) => f.filename) : [];

  try {
    const [result] = await db.query(
      "INSERT INTO procurements (type, title, description, brand, model, year, location, price, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [type, title, description, brand, model, year, location, price, JSON.stringify(imageFiles)]
    );

    res.status(201).json({
      id: result.insertId,
      type,
      title,
      description,
      brand,
      model,
      year,
      location,
      price,
      images: imageFiles,
    });
  } catch (err) {
    console.error("Error creating procurement:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProcurement = async (req, res) => {
  const { id } = req.params;
  const { type, title, description, brand, model, year, location, price } = req.body;
  try {
    await db.query(
      "UPDATE procurements SET type = ?, title = ?, description = ?, brand = ?, model = ?, year = ?, location = ?, price = ? WHERE id = ?",
      [type, title, description, brand, model, year, location, price, id]
    );
    res.json({ message: "Procurement updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteProcurement = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM procurements WHERE id = ?", [id]);
    res.json({ message: "Procurement deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// COMPETITION TYPES
// ============================================

export const getCompetitionTypes = async (req, res) => {
  try {
    console.log("🔥 getCompetitionTypes HIT");
    const [rows] = await db.query("SELECT * FROM competition_types");
    res.json(rows);
  } catch (err) {
    console.error("❌ getCompetitionTypes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// COMPETITIONS
// ============================================

export const getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.*,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        ct.tag AS competition_tag,
        p.id AS procurement_id,
        p.type AS procurement_type,
        p.title AS procurement_title,
        p.description AS procurement_description,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.year AS procurement_year,
        p.location AS procurement_location,
        p.price AS procurement_price,
        p.images AS procurement_images
      FROM competitions c
      JOIN competition_types ct ON c.type_id = ct.id
      JOIN procurements p ON c.procurement_id = p.id
      ORDER BY c.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const createCompetition = async (req, res) => {
  console.log("Request Body:", req.body);
  console.log("Request Files:", req.files);

  const {
    title,
    type_id,
    procurement_id,
    description,
    start_date,
    end_date,
    entry_fee,
    total_participants,
    status,
  } = req.body;

  try {
    const imageFilenames = req.files 
      ? JSON.stringify(req.files.map(file => file.filename)) 
      : JSON.stringify([]);

    const [result] = await db.query(
      `INSERT INTO competitions 
       (title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, status, images) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, status, imageFilenames]
    );

    res.status(201).json({ 
      id: result.insertId, 
      message: "Competition created successfully" 
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateCompetition = async (req, res) => {
  const { id } = req.params;
  const { title, type_id, procurement_id, description, start_date, end_date, entry_fee, status } = req.body;

  try {
    await db.query(
      `UPDATE competitions 
       SET title=?, type_id=?, procurement_id=?, description=?, start_date=?, end_date=?, entry_fee=?, status=? 
       WHERE id=?`,
      [title, type_id, procurement_id, description, start_date, end_date, entry_fee, status, id]
    );
    res.json({ message: "Competition updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteCompetition = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM competitions WHERE id=?", [id]);
    res.json({ message: "Competition deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCompetitionFullDetails = async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Get the competition details with type and procurement
    const [comp] = await db.query(`
      SELECT 
        c.*,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.year AS procurement_year,
        p.location AS procurement_location,
        p.price AS procurement_price,
        p.images AS procurement_images
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      WHERE c.id = ?
    `, [id]);
    
    // 2. Get all tickets with user names
    const [tickets] = await db.query(`
      SELECT 
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM tickets t
      JOIN users u ON t.user_id = u.id 
      WHERE t.competition_id = ? 
      ORDER BY t.created_at DESC
    `, [id]);

    // 3. Check if there is a winner for this competition
    const [winner] = await db.query(`
      SELECT 
        w.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        t.ticket_number
      FROM winners w
      JOIN users u ON w.user_id = u.id
      JOIN tickets t ON w.ticket_id = t.id
      WHERE w.competition_id = ? 
      LIMIT 1
    `, [id]);

    res.json({
      competition: comp[0],
      tickets: tickets,
      winner: winner[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching ledger" });
  }
};

export const drawCompetitionWinner = async (req, res) => {
  const { id } = req.params;
  try {
    const [tickets] = await db.query(
      "SELECT id, ticket_number, user_id FROM tickets WHERE competition_id = ?",
      [id]
    );

    if (tickets.length === 0) {
      return res.status(400).json({ message: "No tickets have been sold for this competition." });
    }

    const randomIndex = Math.floor(Math.random() * tickets.length);
    const winningTicket = tickets[randomIndex];

    await db.query("UPDATE tickets SET is_winner = 1 WHERE id = ?", [winningTicket.id]);
    await db.query("UPDATE competitions SET status = 'Closed' WHERE id = ?", [id]);

    const [winnerDetails] = await db.query(
      "SELECT fullname, email FROM users WHERE id = ?",
      [winningTicket.user_id]
    );

    res.json({
      message: "Winner drawn successfully!",
      winner: {
        name: winnerDetails[0].fullname,
        ticket: winningTicket.ticket_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during the draw process" });
  }
};

// ============================================
// ORDERS MANAGEMENT
// ============================================

export const getAllOrders = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        o.id,
        o.user_id,
        o.reference,
        o.transaction_id,
        o.total_amount,
        o.status,
        o.items,
        o.payment_method,
        o.payment_data,
        o.created_at,
        o.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    const orders = rows.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    }));

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    console.error('❌ Get All Orders Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: err.message,
    });
  }
};

export const getOrderByReference = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { reference } = req.params;

    const [rows] = await db.query(`
      SELECT 
        o.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.reference = ?
    `, [reference]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = {
      ...rows[0],
      items: typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items
    };

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error('❌ Get Order Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: err.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { reference } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, paid, failed, or refunded',
      });
    }

    const [result] = await db.query(
      `UPDATE orders SET status = ? WHERE reference = ?`,
      [status, reference]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
    });
  } catch (err) {
    console.error('❌ Update Order Status Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: err.message,
    });
  }
};

export const adminCreateTickets = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create tickets manually',
      });
    }

    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required',
      });
    }

    console.log(`🎫 Creating tickets manually for reference: ${reference}`);

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

    if (order[0].status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    let items;
    if (typeof order[0].items === 'string') {
      items = JSON.parse(order[0].items);
    } else {
      items = order[0].items;
    }

    await db.query(
      `UPDATE orders SET status = 'paid' WHERE id = ?`,
      [order[0].id]
    );

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

// ============================================
// TICKETS MANAGEMENT
// ============================================

export const getAllTickets = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        t.id,
        t.user_id,
        t.competition_id,
        t.order_id,
        t.ticket_number,
        t.status,
        t.created_at,
        t.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        c.title AS competition_name,
        c.start_date AS competition_start,
        c.end_date AS competition_end,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.price AS procurement_price
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      ORDER BY t.created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get All Tickets Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets',
      error: err.message,
    });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'used', 'expired', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    await db.query(
      `UPDATE tickets SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status}`,
    });
  } catch (err) {
    console.error('❌ Update Ticket Status Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: err.message,
    });
  }
};

// ============================================
// WINNERS MANAGEMENT
// ============================================

export const getAllWinners = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        w.id,
        w.user_id,
        w.competition_id,
        w.ticket_id,
        w.prize_amount,
        w.status,
        w.won_at,
        w.created_at,
        w.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        c.title AS competition_name,
        c.start_date AS competition_start,
        c.end_date AS competition_end,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        t.ticket_number,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model
      FROM winners w
      LEFT JOIN users u ON w.user_id = u.id
      LEFT JOIN competitions c ON w.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN tickets t ON w.ticket_id = t.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      ORDER BY w.won_at DESC
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get All Winners Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve winners',
      error: err.message,
    });
  }
};

export const declareWinner = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { competitionId, ticketNumber, prizeAmount } = req.body;

    if (!competitionId || !ticketNumber) {
      return res.status(400).json({
        success: false,
        message: 'Competition ID and ticket number are required',
      });
    }

    const [ticket] = await db.query(
      `SELECT * FROM tickets WHERE ticket_number = ? AND competition_id = ?`,
      [ticketNumber, competitionId]
    );

    if (!ticket.length) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found for this competition',
      });
    }

    const [existingWinner] = await db.query(
      `SELECT * FROM winners WHERE competition_id = ? AND ticket_id = ?`,
      [competitionId, ticket[0].id]
    );

    if (existingWinner.length) {
      return res.status(400).json({
        success: false,
        message: 'This ticket is already a winner',
      });
    }

    const [result] = await db.query(
      `INSERT INTO winners (user_id, competition_id, ticket_id, prize_amount, status, won_at, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [ticket[0].user_id, competitionId, ticket[0].id, prizeAmount || 0, 'pending']
    );

    await db.query(
      `UPDATE competitions SET winner_id = ?, winning_ticket_number = ? WHERE id = ?`,
      [ticket[0].user_id, ticketNumber, competitionId]
    );

    res.status(200).json({
      success: true,
      message: 'Winner declared successfully!',
      data: {
        id: result.insertId,
        user_id: ticket[0].user_id,
        competition_id: competitionId,
        ticket_number: ticketNumber,
        prize_amount: prizeAmount || 0,
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('❌ Declare Winner Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to declare winner',
      error: err.message,
    });
  }
};

export const payWinner = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { id } = req.params;

    const [winner] = await db.query(
      `SELECT * FROM winners WHERE id = ?`,
      [id]
    );

    if (!winner.length) {
      return res.status(404).json({
        success: false,
        message: 'Winner not found',
      });
    }

    if (winner[0].status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Winner already paid',
      });
    }

    await db.query(
      `UPDATE winners SET status = 'paid', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Winner paid successfully!',
    });
  } catch (err) {
    console.error('❌ Pay Winner Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: err.message,
    });
  }
};

// ============================================
// PAYOUTS MANAGEMENT
// ============================================

export const getAllPayouts = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.user_id,
        p.reference,
        p.amount,
        p.bank_code,
        p.account_number,
        p.account_name,
        p.status,
        p.payout_data,
        p.created_at,
        p.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM payouts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get All Payouts Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payouts',
      error: err.message,
    });
  }
};

export const processPayout = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { id } = req.params;

    const [payout] = await db.query(
      `SELECT * FROM payouts WHERE id = ?`,
      [id]
    );

    if (!payout.length) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    if (payout[0].status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payout already completed',
      });
    }

    await db.query(
      `UPDATE payouts SET status = 'completed', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Payout processed successfully!',
    });
  } catch (err) {
    console.error('❌ Process Payout Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout',
      error: err.message,
    });
  }
};

export const createPayout = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { userId, amount, bankCode, accountNumber, accountName } = req.body;

    if (!userId || !amount || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    const reference = `PO${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const [result] = await db.query(
      `INSERT INTO payouts (user_id, reference, amount, bank_code, account_number, account_name, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, reference, amount, bankCode, accountNumber, accountName, 'pending']
    );

    res.status(200).json({
      success: true,
      message: 'Payout created successfully!',
      data: {
        id: result.insertId,
        reference: reference,
      },
    });
  } catch (err) {
    console.error('❌ Create Payout Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create payout',
      error: err.message,
    });
  }
};

// ============================================
// REPORTS
// ============================================

export const getSalesReport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { period = 'month' } = req.query;

    let dateCondition = '';
    if (period === 'today') {
      dateCondition = 'DATE(created_at) = CURDATE()';
    } else if (period === 'week') {
      dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (period === 'year') {
      dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
    }

    const [orders] = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_orders
      FROM orders
      WHERE ${dateCondition}
    `);

    const [tickets] = await db.query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT competition_id) as unique_competitions
      FROM tickets
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.status(200).json({
      success: true,
      data: {
        period,
        orders: orders[0],
        tickets: tickets[0],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ Get Sales Report Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: err.message,
    });
  }
};

export const getCompetitionReport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [competitions] = await db.query(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.start_date,
        c.end_date,
        c.entry_fee,
        c.total_participants,
        c.status,
        c.winner_id,
        c.winning_ticket_number,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.price AS procurement_price,
        COUNT(t.id) as tickets_sold,
        COALESCE(SUM(t.price), 0) as total_revenue,
        CASE WHEN c.winner_id IS NOT NULL THEN 'Has Winner' ELSE 'No Winner' END as winner_status
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN tickets t ON c.id = t.competition_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: competitions.length,
      data: competitions,
    });
  } catch (err) {
    console.error('❌ Get Competition Report Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate competition report',
      error: err.message,
    });
  }
};

// ============================================
// SCHEDULE MANAGEMENT
// ============================================

export const getSchedule = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.start_date,
        c.end_date,
        c.entry_fee,
        c.total_participants,
        c.status,
        c.created_at,
        c.updated_at,
        c.images,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.price AS procurement_price,
        p.images AS procurement_images
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      ORDER BY c.start_date ASC
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get Schedule Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve schedule',
      error: err.message,
    });
  }
};

// ============================================
// SETTINGS (User Management)
// ============================================

export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        id,
        name,
        email,
        phone,
        role,
        isStudent,
        state,
        lga,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get All Users Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: err.message,
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    await db.query(
      `UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?`,
      [role, id]
    );

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
    });
  } catch (err) {
    console.error('❌ Update User Role Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: err.message,
    });
  }
};

// ============================================
// DASHBOARD STATS
// ============================================

export const getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const [totalUsers] = await db.query("SELECT COUNT(*) as count FROM users");
    const [totalOrders] = await db.query("SELECT COUNT(*) as count, SUM(total_amount) as total_revenue FROM orders WHERE status = 'paid'");
    const [totalTickets] = await db.query("SELECT COUNT(*) as count FROM tickets");
    const [totalCompetitions] = await db.query("SELECT COUNT(*) as count FROM competitions");
    const [pendingOrders] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
    const [recentOrders] = await db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5");

    res.status(200).json({
      success: true,
      data: {
        totalUsers: totalUsers[0].count,
        totalOrders: totalOrders[0].count,
        totalRevenue: totalOrders[0].total_revenue || 0,
        totalTickets: totalTickets[0].count,
        totalCompetitions: totalCompetitions[0].count,
        pendingOrders: pendingOrders[0].count,
        recentOrders: recentOrders,
      }
    });
  } catch (err) {
    console.error('❌ Get Dashboard Stats Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard stats',
      error: err.message,
    });
  }
};