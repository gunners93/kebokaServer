import db from "../config/db.js";

// 🧠 Get full prize/competition details by ID
export const getPrizeDetails = async (req, res) => {
 const { id } = req.params;

  try {
    // Fetch the main competition details
    const [competition] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.*
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       WHERE c.id = ?`,
      [id]
    );

    if (!competition.length) {
      return res.status(404).json({ message: "Competition not found" });
    }

    const comp = competition[0];

    // Parse JSON fields (like images)
    if (comp.images && typeof comp.images === "string") {
      try {
        comp.images = JSON.parse(comp.images);
      } catch {
        comp.images = [];
      }
    }

    res.json({
      success: true,
      data: comp,
    });
  } catch (error) {
    console.error("Error fetching competition:", error);
    res.status(500).json({ message: "Server error" });
  }
}

//get competitions by id
export const getCompetitionById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.* 
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Competition not found" });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// get competitions with image
export const getCompetitions_web = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.*,t.*,
      c.title AS competitions_title ,
      c.id as competitions_id
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       LEFT JOIN competition_types t ON c.type_id = t.id
       `
       
    );

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
//competitionstype from  competition_types where type_name =$type join competitions join procurements
export const getcompetitionstype_web = async (req, res) => {
  const where=req.params.type;
  try {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.*,t.*,
      c.title AS competitions_title ,
      c.id as competitions_id
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       LEFT JOIN competition_types t ON c.type_id = t.id
       WHERE t.type_name = ?`,
       [where]
    );
       const data = rows.map((item) => ({
      ...item,
      images: item.images ? JSON.parse(item.images) : [],
    }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
    
  }

}


export const getStates = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM states ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching states" });
  }
};

export const getLgasByState = async (req, res) => {
  const { stateId } = req.params;
  try {
    const [rows] = await db.query("SELECT id, name FROM lgas WHERE state_id = ? ORDER BY name ASC", [stateId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching LGAs" });
  }
};

export const getSchools = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, school_name, state, has_campus FROM schools ORDER BY school_name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error fetching schools" });
  }
};
// controllers/webController.js

// controllers/webController.js

export const getMyTickets = async (req, res) => {
  console.log("🎟️ Fetching tickets for user:", req.user.id);
  try {
    const userId = req.user.id; // Extracted from verifyToken middleware

    console.log(`🎫 Fetching tickets for user: ${userId}`);

    // Query to get user's tickets with competition and procurement details
    const [rows] = await db.query(`
      SELECT 
        t.id, 
        t.ticket_number, 
        t.status,
        t.created_at,
        c.id AS competition_id,
        c.title AS competition_title,
        c.type_id,
        c.description AS competition_description,
        c.start_date,
        c.end_date,
        c.entry_fee,
        c.total_participants,
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
        p.price AS procurement_price,
        p.images AS procurement_images
      FROM tickets t
      JOIN competitions c ON t.competition_id = c.id
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `, [userId]);

    // Format the response data
    const formattedTickets = rows.map(ticket => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      status: ticket.status || 'active',
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
        images: ticket.competition_images ? JSON.parse(ticket.competition_images) : [],
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
        price: ticket.procurement_price,
        images: ticket.procurement_images ? JSON.parse(ticket.procurement_images) : [],
      } : null,
      // Check if this ticket is a winner
      is_winner: ticket.winner_id && ticket.winning_ticket_number === ticket.ticket_number,
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
      error: err.message 
    });
  }
};
export const updateBankDetails = async (req, res) => {
  let { account_number, bank_name } = req.body;
  const userId = req.user.id;

  // 🔧 Clean inputs
  account_number = account_number?.trim();
  bank_name = bank_name?.trim();

  // ❌ Validation
  if (!account_number || !bank_name) {
    return res.status(400).json({
      success: false,
      message: "Please provide both account number and bank name"
    });
  }

  // ✅ Ensure numeric only
  if (!/^\d{10}$/.test(account_number)) {
    return res.status(400).json({
      success: false,
      message: "Account number must be exactly 10 digits"
    });
  }

  // ✅ Optional: bank name length check
  if (bank_name.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Invalid bank name"
    });
  }

  try {
    // 🔍 Check if user exists first
    const [userRows] = await db.query(
      `SELECT id, account_number, bank_name FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existingUser = userRows[0];

    // ⚠️ Prevent unnecessary update
    if (
      existingUser.account_number === account_number &&
      existingUser.bank_name === bank_name
    ) {
      return res.status(200).json({
        success: true,
        message: "No changes detected"
      });
    }

    // ✅ Update
    await db.query(
      `UPDATE users 
       SET account_number = ?, bank_name = ? 
       WHERE id = ?`,
      [account_number, bank_name, userId]
    );

    res.status(200).json({
      success: true,
      message: "Bank details updated successfully",
      data: { account_number, bank_name }
    });

  } catch (err) {
    console.error("Update Bank Error:", err);

    res.status(500).json({
      success: false,
      message: "Server error during bank update",
      error: err.message
    });
  }
};