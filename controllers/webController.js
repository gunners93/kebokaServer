import db from "../config/db.js";

// 🧠 Get full prize/competition details by ID
export const getPrizeDetails = async (req, res) => {
 const { id } = req.params;

  try {
    // Fetch the main competition details
    const [competition] = await db.promise().query(
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
    const [rows] = await db.promise().query(
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
    const [rows] = await db.promise().query(
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
    const [rows] = await db.promise().query(
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
