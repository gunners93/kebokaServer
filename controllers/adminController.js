import db from "../config/db.js";
// GET all procurements
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
export const adminLogin = async (req, res) => {
  const { username, password } = req.body;


  // const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // 1. Check the adminlog table
    const [rows] = await db.query("SELECT * FROM adminlog WHERE username = ?", [username]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid Admin" });
    }

    const admin = rows[0];

    // 2. Compare Password (assuming it's hashed, use 'password === admin.password' if plain text)
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    // 3. Create Token with 'admin' role asnd  y
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

// 🟢 Create new procurement
export const createProcurement = async (req, res) => {
  const { type, title, description, brand, model, year, location, price } =
    req.body;

  const imageFiles = req.files ? req.files.map((f) => f.filename) : [];

  try {
    const [result] = await db
     
      .query(
        "INSERT INTO procurements (type, title, description, brand, model, year, location, price, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          type,
          title,
          description,
          brand,
          model,
          year,
          location,
          price,
          JSON.stringify(imageFiles),
        ]
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
//// 🟠 Update procurement
export const updateProcurement = async (req, res) => {
    const { id } = req.params;
    const { type, title, description, brand, model, year, location, price }
        = req.body;
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
// 🔴 Delete procurement
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


// select Competitions

// 🟢 Get all competitions
export const getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, 
             p.*,
             t.name AS type_name, 
             t.type_name AS competition_type_name,
             c.id AS competition_id,
              c.title AS competitions_title ,
             p.title AS procurement_title 
      FROM competitions c
      JOIN competition_types t ON c.type_id = t.id
      JOIN procurements p ON c.procurement_id = p.id
      ORDER BY c.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🟢 Update competition
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
// 🟢 Delete competition
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

// // select competition_types
// export const getCompetitionTypes = async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT * FROM competition_types");
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getCompetitionTypes = async (req, res) => {
  try {
    console.log("🔥 getCompetitionTypes HIT");

    const [rows] = await db
     
      .query("SELECT * FROM competition_types");

    res.json(rows);
  } catch (err) {
    console.error("❌ getCompetitionTypes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const createCompetition = async (req, res) => {
  console.log("Request Body:", req.body);
  console.log("Request Files:", req.files); // Debugging images

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
    // 1. Extract filenames from the uploaded files array
    // We store them as a JSON string so you can easily pull them back out as an array
    const imageFilenames = req.files 
      ? JSON.stringify(req.files.map(file => file.filename)) 
      : JSON.stringify([]);

    // 2. Insert into Database
    const [result] = await db.query(
      `INSERT INTO competitions 
       (title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, status, images) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, 
        type_id, 
        procurement_id, 
        description, 
        start_date, 
        end_date, 
        entry_fee, 
        total_participants, 
        status, 
        imageFilenames // The new images column
      ]
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
export const getCompetitionFullDetails = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get the competition details
    const [comp] = await db.query('SELECT * FROM competitions WHERE id = ?', [id]);
    
    // 2. Get all tickets and the names of the users who bought them
    const [tickets] = await db.query(
      `SELECT user_tickets.*, users.name 
       FROM user_tickets 
       JOIN users ON user_tickets.user_id = users.id 
       WHERE user_tickets.competition_id = ? 
       ORDER BY user_tickets.created_at DESC`, 
      [id]
    );

    // 3. Check if there is a winner for this competition
    const [winner] = await db.query(
      `SELECT user_tickets.ticket_number, users.name 
       FROM user_tickets 
       JOIN users ON user_tickets.user_id = users.id 
       WHERE user_tickets.competition_id = ? AND user_tickets.is_winner = 1 
       LIMIT 1`, 
      [id]
    );

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
    // 1. Get all tickets for this competition
    const [tickets] = await db.query(
      "SELECT id, ticket_number, user_id FROM tickets WHERE competition_id = ?",
      [id]
    );

    if (tickets.length === 0) {
      return res.status(400).json({ message: "No tickets have been sold for this competition." });
    }

    // 2. Pick a random index from the array
    const randomIndex = Math.floor(Math.random() * tickets.length);
    const winningTicket = tickets[randomIndex];

    // 3. Update the ticket as the winner AND close the competition
    await db.query("UPDATE tickets SET is_winner = 1 WHERE id = ?", [winningTicket.id]);
    await db.query("UPDATE competitions SET status = 'Closed' WHERE id = ?", [id]);

    // 4. Return the winner's details
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