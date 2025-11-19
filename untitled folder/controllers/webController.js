import db from "../config/db.js";

// 🧠 Get full prize/competition details by ID
export const getPrizeDetails = async (req, res) => {
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

    if (!rows.length) {
      return res.status(404).json({ message: "Competition not found" });
    }

    const competition = { ...rows[0] };
    competition.images = parseJSONSafe(competition.images);

    res.json({
      success: true,
      data: competition,
    });
  } catch (error) {
    console.error("Error fetching competition:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get competition by ID
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

    if (!rows.length) {
      return res.status(404).json({ message: "Competition not found" });
    }

    const competition = { ...rows[0] };
    competition.images = parseJSONSafe(competition.images);

    res.json({ success: true, data: competition });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get all competitions (web) with images parsed
export const getCompetitionsWeb = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.*,
              c.title AS competitions_title,
              c.id AS competitions_id
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id`
    );

    const data = rows.map((item) => ({
      ...item,
      images: parseJSONSafe(item.images),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get competitions by type (web) with images parsed
export const getCompetitionsByTypeWeb = async (req, res) => {
  const { type } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS competition_type, p.*,
              c.title AS competitions_title,
              c.id AS competitions_id
       FROM competitions c
       LEFT JOIN competition_types ct ON c.type_id = ct.id
       LEFT JOIN procurements p ON c.procurement_id = p.id
       WHERE ct.type_name = ?`,
      [type]
    );

    const data = rows.map((item) => ({
      ...item,
      images: parseJSONSafe(item.images),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ⚡ Helper function: safely parse JSON
function parseJSONSafe(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
