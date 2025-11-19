import db from "../config/db.js";

// =========================
// GET ALL PROCUREMENTS
// =========================
export const getProcurements = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM procurements ORDER BY id DESC");

    const data = rows.map((item) => ({
      ...item,
      images: item.images ? JSON.parse(item.images) : [],
    }));

    res.json(data);
  } catch (err) {
    console.error("getProcurements Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// CREATE PROCUREMENT
// =========================
export const createProcurement = async (req, res) => {
  const { type, title, description, brand, model, year, location, price } =
    req.body;

  const imageFiles = req.files ? req.files.map((f) => f.filename) : [];

  try {
    const [result] = await db.query(
      `INSERT INTO procurements 
      (type, title, description, brand, model, year, location, price, images) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    console.error("createProcurement Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// UPDATE PROCUREMENT
// =========================
export const updateProcurement = async (req, res) => {
  const { id } = req.params;
  const { type, title, description, brand, model, year, location, price } =
    req.body;

  try {
    await db.query(
      `UPDATE procurements 
       SET type=?, title=?, description=?, brand=?, model=?, year=?, location=?, price=? 
       WHERE id=?`,
      [type, title, description, brand, model, year, location, price, id]
    );

    res.json({ message: "Procurement updated successfully" });
  } catch (err) {
    console.error("updateProcurement Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// DELETE PROCUREMENT
// =========================
export const deleteProcurement = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM procurements WHERE id=?", [id]);
    res.json({ message: "Procurement deleted successfully" });
  } catch (err) {
    console.error("deleteProcurement Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// GET COMPETITIONS
// =========================
export const getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.*, 
        p.*,
        t.name AS type_name, 
        t.type_name AS competition_type_name,
        c.id AS competition_id,
        c.title AS competitions_title,
        p.title AS procurement_title
      FROM competitions c
      JOIN competition_types t ON c.type_id = t.id
      JOIN procurements p ON c.procurement_id = p.id
      ORDER BY c.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("getCompetitions Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// UPDATE COMPETITION
// =========================
export const updateCompetition = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    type_id,
    procurement_id,
    description,
    start_date,
    end_date,
    entry_fee,
    status,
  } = req.body;

  try {
    await db.query(
      `UPDATE competitions 
       SET title=?, type_id=?, procurement_id=?, description=?, start_date=?, end_date=?, entry_fee=?, status=? 
       WHERE id=?`,
      [title, type_id, procurement_id, description, start_date, end_date, entry_fee, status, id]
    );

    res.json({ message: "Competition updated successfully" });
  } catch (err) {
    console.error("updateCompetition Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// DELETE COMPETITION
// =========================
export const deleteCompetition = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM competitions WHERE id=?", [id]);
    res.json({ message: "Competition deleted successfully" });
  } catch (err) {
    console.error("deleteCompetition Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// GET COMPETITION TYPES
// =========================
export const getCompetitionTypes = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM competition_types");
    res.json(rows);
  } catch (err) {
    console.error("getCompetitionTypes Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// CREATE COMPETITION
// =========================
export const createCompetition = async (req, res) => {
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
    const [result] = await db.query(
      `INSERT INTO competitions 
       (title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: "Competition created successfully",
    });
  } catch (err) {
    console.error("createCompetition Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
