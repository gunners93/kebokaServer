// webController.js
import db from "../config/db.js";

// ============================================
// HELPER: Safe JSON Parse
// ============================================
const safeParseJSON = (value, fallback = []) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return fallback;
      }
    }
    return [trimmed];
  }
  return fallback;
};

// ============================================
// GET FULL PRIZE DETAILS BY ID
// ============================================
export const getPrizeDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [competition] = await db.query(
      `SELECT 
        c.*,
        c.title AS competitions_title,
        c.id AS competitions_id,
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
        p.images AS procurement_images,
        p.available_quantity AS procurement_available,
        pc.name AS procurement_category_name,
        pc.slug AS procurement_category_slug,
        ps.name AS procurement_subcategory_name,
        ps.slug AS procurement_subcategory_slug,
        (SELECT COUNT(*) FROM tickets t WHERE t.competition_id = c.id) AS tickets_sold
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       LEFT JOIN procurement_categories pc ON p.category_id = pc.id
       LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
       WHERE c.id = ?`,
      [id]
    );

    if (!competition.length) {
      return res.status(404).json({ 
        success: false, 
        message: "Competition not found" 
      });
    }

    const comp = competition[0];
    comp.images = safeParseJSON(comp.images, []);
    comp.procurement_images = safeParseJSON(comp.procurement_images, []);

    res.json({
      success: true,
      data: comp,
    });
  } catch (error) {
    console.error("Error fetching competition:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET COMPETITION BY ID
// ============================================
export const getCompetitionById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
        c.*,
        c.title AS competitions_title,
        c.id AS competitions_id,
        ct.id AS type_id,
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
        pc.name AS procurement_category_name
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       LEFT JOIN procurement_categories pc ON p.category_id = pc.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Competition not found" 
      });
    }

    const data = rows[0];
    data.images = safeParseJSON(data.images, []);
    data.procurement_images = safeParseJSON(data.procurement_images, []);

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET ALL COMPETITIONS FOR WEB
// ============================================
export const getCompetitions_web = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        c.*,
        c.title AS competitions_title,
        c.id AS competitions_id,
        ct.id AS type_id,
        ct.type_name AS type_name,               -- ✅ ADD THIS
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
       ORDER BY c.id DESC`
    );

    const data = rows.map((item) => ({
      ...item,
      images: safeParseJSON(item.images, []),
      procurement_images: safeParseJSON(item.procurement_images, []),
    }));

    res.json(data);
  } catch (err) {
    console.error('❌ getCompetitions_web error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET COMPETITIONS BY TYPE
// ============================================
// controllers/webController.js
export const getcompetitionstype_web = async (req, res) => {
  const where = req.params.type;

  try {
    const [rows] = await db.query(
      `SELECT 
        c.*,
        c.title AS competitions_title,
        c.id AS competitions_id,
        ct.id AS type_id,
        ct.type_name AS type_name,               -- ✅ ADD THIS
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image,
        ct.tag AS competition_tag,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.year AS procurement_year,
        p.location AS procurement_location,
        p.value AS procurement_value,
        p.images AS procurement_images,
        pc.name AS procurement_category_name,
        ps.name AS procurement_subcategory_name,
        (SELECT COUNT(*) FROM tickets t WHERE t.competition_id = c.id) AS tickets_sold
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       LEFT JOIN procurement_categories pc ON p.category_id = pc.id
       LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
       WHERE ct.type_name = ?
       ORDER BY c.id DESC`,
      [where]
    );

    const data = rows.map((item) => ({
      ...item,
      images: safeParseJSON(item.images, []),
      procurement_images: safeParseJSON(item.procurement_images, []),
    }));

    res.json(data);
  } catch (err) {
    console.error('❌ getcompetitionstype_web error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET COMPETITION TYPES (FOR EXPLORE SECTION)
// ============================================
export const getCompetitionTypes_web = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ct.id,
        ct.name,
        ct.type_name,
        ct.bgcolor,
        ct.img,
        ct.tag,
        ct.created_at,
        (SELECT COUNT(*) FROM competitions c WHERE c.type_id = ct.id) AS competition_count
      FROM competition_types ct
      ORDER BY ct.name ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('❌ getCompetitionTypes_web error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET STATES
// ============================================
export const getStates = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM states ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching states" });
  }
};

// ============================================
// GET LGAS BY STATE
// ============================================
export const getLgasByState = async (req, res) => {
  const { stateId } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT id, name FROM lgas WHERE state_id = ? ORDER BY name ASC",
      [stateId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching LGAs" });
  }
};

// ============================================
// GET SCHOOLS
// ============================================
export const getSchools = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, school_name, state, has_campus FROM schools ORDER BY school_name ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching schools" });
  }
};

// ============================================
// GET MY TICKETS
// ============================================
export const getMyTickets = async (req, res) => {
  console.log("🎟️ Fetching tickets for user:", req.user.id);

  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        t.id, 
        t.ticket_number, 
        t.status,
        t.is_winner,
        t.created_at,
        c.id AS competition_id,
        c.title AS competition_title,
        c.type_id,
        c.description AS competition_description,
        c.start_date,
        c.end_date,
        c.entry_fee,
        c.total_participants,
        c.total_winners,
        c.winners_drawn,
        c.winner_id,
        c.winning_ticket_number,
        c.images AS competition_images,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.img AS competition_type_image,
        ct.bgcolor AS competition_type_color,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.description AS procurement_description,
        p.brand,
        p.model,
        p.year,
        p.location,
        p.value AS procurement_value,
        p.market_value AS procurement_market_value,
        p.images AS procurement_images,
        pc.name AS procurement_category_name,
        ps.name AS procurement_subcategory_name
      FROM tickets t
      JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `, [userId]);

    const formattedTickets = rows.map(ticket => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      status: ticket.status || 'active',
      is_winner: ticket.is_winner === 1 || ticket.is_winner === true,
      created_at: ticket.created_at,
      competition: {
        id: ticket.competition_id,
        title: ticket.competition_title,
        description: ticket.competition_description,
        type: {
          id: ticket.type_id,
          name: ticket.competition_type_name,
          type_name: ticket.competition_type,
          image: ticket.competition_type_image,
          color: ticket.competition_type_color,
        },
        start_date: ticket.start_date,
        end_date: ticket.end_date,
        entry_fee: ticket.entry_fee,
        total_participants: ticket.total_participants,
        total_winners: ticket.total_winners || 1,
        winners_drawn: ticket.winners_drawn || 0,
        images: safeParseJSON(ticket.competition_images, []),
        winner_id: ticket.winner_id,
        winning_ticket_number: ticket.winning_ticket_number,
      },
      procurement: ticket.procurement_id ? {
        id: ticket.procurement_id,
        title: ticket.procurement_title,
        description: ticket.procurement_description,
        brand: ticket.brand,
        model: ticket.model,
        year: ticket.year,
        location: ticket.location,
        value: ticket.procurement_value,
        market_value: ticket.procurement_market_value,
        images: safeParseJSON(ticket.procurement_images, []),
        category: ticket.procurement_category_name,
        subcategory: ticket.procurement_subcategory_name,
      } : null,
    }));

    console.log(`✅ Found ${formattedTickets.length} tickets for user ${userId}`);

    res.status(200).json({
      message: "Tickets retrieved successfully",
      success: true,
      count: formattedTickets.length,
      data: formattedTickets,
    });

  } catch (err) {
    console.error("❌ Fetch Tickets Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve your tickets",
      error: err.message,
    });
  }
};

// ============================================
// UPDATE BANK DETAILS
// ============================================
export const updateBankDetails = async (req, res) => {
  let { account_number, bank_name } = req.body;
  const userId = req.user.id;

  account_number = account_number?.trim();
  bank_name = bank_name?.trim();

  if (!account_number || !bank_name) {
    return res.status(400).json({
      success: false,
      message: "Please provide both account number and bank name",
    });
  }

  if (!/^\d{10}$/.test(account_number)) {
    return res.status(400).json({
      success: false,
      message: "Account number must be exactly 10 digits",
    });
  }

  if (bank_name.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Invalid bank name",
    });
  }

  try {
    const [userRows] = await db.query(
      `SELECT id, account_number, bank_name FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingUser = userRows[0];

    if (
      existingUser.account_number === account_number &&
      existingUser.bank_name === bank_name
    ) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
      });
    }

    await db.query(
      `UPDATE users SET account_number = ?, bank_name = ? WHERE id = ?`,
      [account_number, bank_name, userId]
    );

    res.status(200).json({
      success: true,
      message: "Bank details updated successfully",
      data: { account_number, bank_name },
    });

  } catch (err) {
    console.error("Update Bank Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during bank update",
      error: err.message,
    });
  }
};

// ============================================
// GET COMPETITION WINNERS (Public)
// ============================================
export const getCompetitionWinners = async (req, res) => {
  const { id } = req.params;

  try {
    const [winners] = await db.query(`
      SELECT 
        w.id,
        w.prize_amount,
        w.status,
        w.won_at,
        t.ticket_number,
        u.name AS user_name,
        u.state AS user_state,
        u.lga AS user_lga
      FROM winners w
      LEFT JOIN tickets t ON w.ticket_id = t.id
      LEFT JOIN users u ON w.user_id = u.Id
      WHERE w.competition_id = ?
      ORDER BY w.won_at ASC
    `, [id]);

    res.json({
      success: true,
      count: winners.length,
      data: winners,
    });
  } catch (err) {
    console.error('❌ getCompetitionWinners error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};