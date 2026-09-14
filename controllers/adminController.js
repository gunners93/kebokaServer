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

// controllers/adminController.js
export const getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.*,
        c.title AS competitions_title,
        c.id AS competition_id,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        ct.tag AS competition_tag,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.description AS procurement_description,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.year AS procurement_year,
        p.location AS procurement_location,
        p.value AS procurement_value,
        p.market_value AS procurement_market_value,
        p.available_quantity AS procurement_available,
        p.images AS procurement_images,
        pc.name AS procurement_category_name,
        pc.slug AS procurement_category_slug,
        ps.name AS procurement_subcategory_name,
        ps.slug AS procurement_subcategory_slug,
        (SELECT COUNT(*) FROM tickets t WHERE t.competition_id = c.id) AS tickets_sold,
        (SELECT COUNT(*) FROM winners w WHERE w.competition_id = c.id) AS winners_count
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      ORDER BY c.id DESC
    `);

    // Safe JSON parse
    const safeParse = (val, fallback = []) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [val];
      }
    };

    const data = rows.map(c => ({
      ...c,
      images: safeParse(c.images, []),
      procurement_images: safeParse(c.procurement_images, []),
    }));

    res.json(data);
  } catch (err) {
    console.error('❌ getCompetitions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// controllers/competitionController.js

export const createCompetition = async (req, res) => {
  try {
    console.log("========================================");
    console.log("📥 CREATE COMPETITION REQUEST");
    console.log("========================================");
    console.log("Body:", req.body);
    console.log("Files:", req.files?.map(f => f.filename));

    const {
      title,
      type_id,
      procurement_id,
      description,
      start_date,
      end_date,
      entry_fee,
      total_participants,
      total_winners = 1,
      status = 'Active',
    } = req.body;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!title || !type_id || !procurement_id || !start_date || !end_date || !entry_fee) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missing: {
          title: !title,
          type_id: !type_id,
          procurement_id: !procurement_id,
          start_date: !start_date,
          end_date: !end_date,
          entry_fee: !entry_fee,
        },
      });
    }

    // ✅ CHECK PROCUREMENT EXISTS
    console.log(`🔍 Checking procurement ID: ${procurement_id}`);
    const [procurement] = await db.query(
      'SELECT id, title, available_quantity, quantity FROM procurements WHERE id = ?',
      [procurement_id]
    );
    console.log("🔍 Procurement result:", procurement);

    if (!procurement.length) {
      console.log(`❌ Procurement ${procurement_id} NOT FOUND`);
      return res.status(400).json({
        success: false,
        message: `Procurement with ID ${procurement_id} does not exist.`,
        hint: 'The selected prize may have been deleted. Refresh the page and select a new prize.',
      });
    }

    // ✅ CHECK COMPETITION TYPE EXISTS
    console.log(`🔍 Checking competition type ID: ${type_id}`);
    const [compType] = await db.query(
      'SELECT id, name FROM competition_types WHERE id = ?',
      [type_id]
    );
    console.log("🔍 Competition type result:", compType);

    if (!compType.length) {
      console.log(`❌ Competition type ${type_id} NOT FOUND`);
      return res.status(400).json({
        success: false,
        message: `Competition type with ID ${type_id} does not exist.`,
        hint: 'Refresh the page and select a valid type.',
      });
    }

    // ✅ CHECK STOCK
    const winnersCount = parseInt(total_winners) || 1;
    const availableQty = procurement[0].available_quantity || 0;
    console.log(`📊 Winners: ${winnersCount}, Available: ${availableQty}`);

    if (winnersCount > availableQty) {
      console.log(`❌ Not enough stock`);
      return res.status(400).json({
        success: false,
        message: `Not enough items in stock. Only ${availableQty} available but ${winnersCount} winners requested.`,
        available: availableQty,
        requested: winnersCount,
      });
    }

    // ✅ BUILD IMAGES
    const imageFilenames = req.files
      ? JSON.stringify(req.files.map(f => f.filename))
      : JSON.stringify([]);

    // ✅ INSERT (with total_winners)
    console.log("📝 Inserting competition...");
    const [result] = await db.query(`
      INSERT INTO competitions 
      (title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, total_winners, status, images) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      parseInt(type_id),
      parseInt(procurement_id),
      description || null,
      start_date,
      end_date,
      parseFloat(entry_fee),
      parseInt(total_participants) || 100,
      winnersCount,
      status,
      imageFilenames,
    ]);

    console.log(`✅ Competition created with ID: ${result.insertId}`);

    // ✅ DEDUCT STOCK
    await db.query(`
      UPDATE procurements 
      SET available_quantity = available_quantity - ?, updated_at = NOW()
      WHERE id = ?
    `, [winnersCount, procurement_id]);

    console.log(`✅ Deducted ${winnersCount} from procurement ${procurement_id}. Remaining: ${availableQty - winnersCount}`);
    console.log("========================================");

    return res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Competition created successfully',
      procurement_remaining: availableQty - winnersCount,
    });

  } catch (err) {
    console.error("❌ ========================================");
    console.error("❌ CREATE COMPETITION ERROR");
    console.error("❌ ========================================");
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    console.error("SQL message:", err.sqlMessage);
    console.error("SQL state:", err.sqlState);
    console.error("Full error:", err);
    console.error("========================================");

    // Return detailed error
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || err.message,
      code: err.code,
      hint: err.code === 'ER_NO_REFERENCED_ROW_2'
        ? 'One of the foreign keys is invalid. Check type_id and procurement_id.'
        : err.code === 'ER_BAD_NULL_ERROR'
        ? 'A required field is null.'
        : undefined,
    });
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

    const { status, competition_id, search } = req.query;

    let query = `
      SELECT 
        t.id,
        t.user_id,
        t.competition_id,
        t.order_id,
        t.ticket_number,
        t.status,
        t.is_winner,
        t.created_at,
        t.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        c.title AS competition_name,
        c.start_date AS competition_start,
        c.end_date AS competition_end,
        c.status AS competition_status,
        ct.id AS competition_type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.value AS procurement_value,
        p.images AS procurement_images,
        o.reference AS order_reference,
        o.total_amount AS order_amount,
        o.status AS order_status,
        o.payment_method AS order_payment_method
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (competition_id) {
      query += ` AND t.competition_id = ?`;
      params.push(competition_id);
    }

    if (search) {
      query += ` AND (
        t.ticket_number LIKE ? OR 
        u.name LIKE ? OR 
        u.email LIKE ? OR 
        c.title LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [rows] = await db.query(query, params);

    // Parse JSON images safely
    const safeParse = (val, fallback = []) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [val];
      }
    };

    const tickets = rows.map(t => ({
      ...t,
      procurement_images: safeParse(t.procurement_images, []),
      is_winner: t.is_winner === 1 || t.is_winner === true,
    }));

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
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


// Update ticket status
export const updateTicketStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'used', 'expired', 'pending', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const [result] = await db.query(
      `UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({
      success: true,
      message: `Ticket status updated to ${status}`,
    });
  } catch (err) {
    console.error('❌ Update Ticket Status Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk update ticket status
export const bulkUpdateTicketStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { ticketIds, status } = req.body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No tickets selected' });
    }

    const validStatuses = ['active', 'used', 'expired', 'pending', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const placeholders = ticketIds.map(() => '?').join(',');
    const [result] = await db.query(
      `UPDATE tickets SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
      [status, ...ticketIds]
    );

    res.json({
      success: true,
      message: `Updated ${result.affectedRows} tickets to ${status}`,
      updated: result.affectedRows,
    });
  } catch (err) {
    console.error('❌ Bulk Update Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// Delete ticket
export const deleteTicket = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const [result] = await db.query(`DELETE FROM tickets WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (err) {
    console.error('❌ Delete Ticket Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get ticket statistics
export const getTicketStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const [stats] = await db.query(`
      SELECT 
        COUNT(*) AS total_tickets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_tickets,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_tickets,
        COUNT(CASE WHEN status = 'used' THEN 1 END) AS used_tickets,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) AS expired_tickets,
        COUNT(CASE WHEN is_winner = 1 THEN 1 END) AS winning_tickets,
        COUNT(DISTINCT user_id) AS unique_users,
        COUNT(DISTINCT competition_id) AS unique_competitions
      FROM tickets
    `);

    const [byType] = await db.query(`
      SELECT 
        ct.name AS competition_type,
        COUNT(t.id) AS ticket_count,
        SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_count
      FROM tickets t
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      GROUP BY ct.id, ct.name
      ORDER BY ticket_count DESC
    `);

    const [recentTickets] = await db.query(`
      SELECT 
        t.id,
        t.ticket_number,
        t.status,
        t.created_at,
        u.name AS user_name,
        c.title AS competition_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN competitions c ON t.competition_id = c.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overall: stats[0],
        by_type: byType,
        recent: recentTickets,
      }
    });
  } catch (err) {
    console.error('❌ Get Ticket Stats Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// Export tickets (CSV)
export const exportTickets = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const [rows] = await db.query(`
      SELECT 
        t.ticket_number,
        t.status,
        t.is_winner,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        c.title AS competition_name,
        o.reference AS order_reference,
        o.total_amount AS order_amount,
        t.created_at
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN orders o ON t.order_id = o.id
      ORDER BY t.created_at DESC
    `);

    // Build CSV
    const headers = [
      'Ticket Number', 'Status', 'Winner', 'User Name', 'User Email',
      'User Phone', 'Competition', 'Order Reference', 'Order Amount', 'Created At'
    ];
    const rowsCsv = rows.map(r => [
      r.ticket_number,
      r.status,
      r.is_winner ? 'YES' : 'NO',
      r.user_name || '',
      r.user_email || '',
      r.user_phone || '',
      r.competition_name || '',
      r.order_reference || '',
      r.order_amount || 0,
      r.created_at ? new Date(r.created_at).toISOString() : '',
    ]);

    const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(','), ...rowsCsv.map(row => row.map(escape).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tickets-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('❌ Export Error:', err);
    res.status(500).json({ success: false, message: err.message });
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
// Get single ticket details
export const getTicketById = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT 
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        c.title AS competition_name,
        c.description AS competition_description,
        c.start_date AS competition_start,
        c.end_date AS competition_end,
        c.status AS competition_status,
        c.winner_id AS competition_winner_id,
        c.winning_ticket_number,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.value AS procurement_value,
        p.images AS procurement_images,
        o.reference AS order_reference,
        o.total_amount AS order_amount,
        o.status AS order_status,
        o.payment_method AS order_payment_method,
        o.transaction_id AS order_transaction_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.id = ?
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const safeParse = (val, fallback = []) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [val];
      }
    };

    const ticket = rows[0];
    ticket.procurement_images = safeParse(ticket.procurement_images, []);
    ticket.is_winner = ticket.is_winner === 1 || ticket.is_winner === true;

    res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('❌ Get Ticket Error:', err);
    res.status(500).json({ success: false, message: err.message });
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
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { search, status } = req.query;

    let query = `
      SELECT 
        u.Id AS id,
        u.name,
        u.email,
        u.phone,
        u.isStudent,
        u.state,
        u.lga,
        u.city,
        u.occupation,
        u.schoolName,
        u.department,
        u.account_number,
        u.bank_name,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.Id) AS total_tickets,
        (SELECT COUNT(*) FROM winners w WHERE w.user_id = u.Id) AS total_wins,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.user_id = u.Id AND o.status = 'paid') AS total_spent
      FROM users u
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (status === 'student') {
      query += ` AND u.isStudent = 'yes'`;
    } else if (status === 'non-student') {
      query += ` AND u.isStudent = 'no'`;
    }

    query += ` ORDER BY u.created_at DESC`;

    const [rows] = await db.query(query, params);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('❌ Get All Users Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// Get single user with full details
export const getUserById = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const [user] = await db.query(`
      SELECT 
        u.Id AS id,
        u.name,
        u.email,
        u.phone,
        u.isStudent,
        u.state,
        u.lga,
        u.city,
        u.occupation,
        u.schoolName,
        u.department,
        u.account_number,
        u.bank_name,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.Id = ?
    `, [id]);

    if (!user.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's tickets
    const [tickets] = await db.query(`
      SELECT 
        t.id,
        t.ticket_number,
        t.status,
        t.is_winner,
        t.created_at,
        c.title AS competition_name,
        ct.name AS competition_type
      FROM tickets t
      LEFT JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [id]);

    // Get user's orders
    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.reference,
        o.total_amount,
        o.status,
        o.payment_method,
        o.created_at
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 20
    `, [id]);

    // Get user's wins
    const [wins] = await db.query(`
      SELECT 
        w.id,
        w.prize_amount,
        w.status,
        w.won_at,
        c.title AS competition_name,
        t.ticket_number
      FROM winners w
      LEFT JOIN competitions c ON w.competition_id = c.id
      LEFT JOIN tickets t ON w.ticket_id = t.id
      WHERE w.user_id = ?
      ORDER BY w.won_at DESC
    `, [id]);

    // Get stats
    const [stats] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM tickets WHERE user_id = ?) AS total_tickets,
        (SELECT COUNT(*) FROM winners WHERE user_id = ?) AS total_wins,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = ? AND status = 'paid') AS total_spent,
        (SELECT COUNT(*) FROM orders WHERE user_id = ?) AS total_orders
    `, [id, id, id, id]);

    res.json({
      success: true,
      data: {
        user: user[0],
        tickets,
        orders,
        wins,
        stats: stats[0],
      },
    });
  } catch (err) {
    console.error('❌ Get User Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Prevent removing the last admin
    if (role !== 'admin') {
      const [admins] = await db.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND Id != ?",
        [id]
      );
      if (admins[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last admin account',
        });
      }
    }

    await db.query(
      `UPDATE users SET role = ?, updated_at = NOW() WHERE Id = ?`,
      [role, id]
    );

    res.json({
      success: true,
      message: `User role updated to ${role}`,
    });
  } catch (err) {
    console.error('❌ Update User Role Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update user details (admin can edit)

export const updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    const {
      name, phone, state, lga, city, isStudent, occupation,
      schoolName, department, account_number, bank_name
    } = req.body;

    const updates = [];
    const values = [];

    const fields = {
      name, phone, state, lga, city, isStudent, occupation,
      schoolName, department, account_number, bank_name
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE Id = ?`,
      values
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('❌ Update User Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const [result] = await db.query('DELETE FROM users WHERE Id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Delete User Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const [stats] = await db.query(`
      SELECT 
        COUNT(*) AS total_users,
        COUNT(CASE WHEN isStudent = 'yes' THEN 1 END) AS students,
        COUNT(CASE WHEN isStudent = 'no' THEN 1 END) AS non_students,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS new_this_month,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS new_this_week
      FROM users
    `);

    // Get admin count from adminlog table
    const [adminStats] = await db.query(`
      SELECT COUNT(*) AS total_admins FROM adminlog
    `);

    const [recent] = await db.query(`
      SELECT 
        Id AS id, name, email, phone, isStudent, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        overall: {
          ...stats[0],
          total_admins: adminStats[0].total_admins,
        },
        recent,
      },
    });
  } catch (err) {
    console.error('❌ Get User Stats Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export users CSV
export const exportUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const [rows] = await db.query(`
      SELECT 
        Id AS id, name, email, phone, isStudent, state, lga, city,
        occupation, schoolName, department, bank_name, account_number, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const headers = [
      'ID', 'Name', 'Email', 'Phone', 'Student', 'State', 'LGA',
      'City', 'Occupation', 'School', 'Department', 'Bank', 'Account Number', 'Created At'
    ];

    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const csvRows = rows.map(r => [
      r.id, r.name, r.email, r.phone, r.isStudent, r.state, r.lga,
      r.city, r.occupation, r.schoolName, r.department, r.bank_name,
      r.account_number, r.created_at ? new Date(r.created_at).toISOString() : '',
    ]);

    const csv = [
      headers.map(escape).join(','),
      ...csvRows.map(r => r.map(escape).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('❌ Export Users Error:', err);
    res.status(500).json({ success: false, message: err.message });
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