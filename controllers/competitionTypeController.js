// controllers/competitionTypeController.js
import db from '../config/db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ============================================
// MULTER CONFIG (for type image/icon upload)
// ============================================
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `competition-type-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single('img');

// ============================================
// GET ALL COMPETITION TYPES
// ============================================
export const getAllCompetitionTypes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ct.*,
        (SELECT COUNT(*) FROM competitions c WHERE c.type_id = ct.id) AS competition_count
      FROM competition_types ct
      ORDER BY ct.name ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('❌ getAllCompetitionTypes error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// GET SINGLE COMPETITION TYPE
// ============================================
export const getCompetitionTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT * FROM competition_types WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Competition type not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('❌ getCompetitionTypeById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// CREATE COMPETITION TYPE
// ============================================
export const createCompetitionType = async (req, res) => {
  try {
    const { name, type_name, tag, bgcolor } = req.body;

    if (!name || !type_name) {
      return res.status(400).json({
        success: false,
        message: 'Name and type_name are required',
      });
    }

    // Check for duplicate type_name
    const [existing] = await db.query(
      `SELECT id FROM competition_types WHERE type_name = ?`,
      [type_name]
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: `Competition type "${type_name}" already exists`,
      });
    }

    const img = req.file ? req.file.filename : null;

    const [result] = await db.query(
      `INSERT INTO competition_types (name, type_name, tag, bgcolor, img, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        name,
        type_name,
        tag || null,
        bgcolor || 'bg-green-500',
        img,
      ]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Competition type created successfully',
    });
  } catch (err) {
    console.error('❌ createCompetitionType error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ============================================
// UPDATE COMPETITION TYPE
// ============================================
export const updateCompetitionType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type_name, tag, bgcolor } = req.body;

    const [existing] = await db.query(
      `SELECT * FROM competition_types WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Competition type not found' });
    }

    // If type_name changed, check for duplicate
    if (type_name && type_name !== existing[0].type_name) {
      const [dup] = await db.query(
        `SELECT id FROM competition_types WHERE type_name = ? AND id != ?`,
        [type_name, id]
      );
      if (dup.length) {
        return res.status(400).json({
          success: false,
          message: `Competition type "${type_name}" already exists`,
        });
      }
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (type_name !== undefined) {
      updates.push('type_name = ?');
      values.push(type_name);
    }
    if (tag !== undefined) {
      updates.push('tag = ?');
      values.push(tag);
    }
    if (bgcolor !== undefined) {
      updates.push('bgcolor = ?');
      values.push(bgcolor);
    }
    if (req.file) {
      updates.push('img = ?');
      values.push(req.file.filename);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE competition_types SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({ success: true, message: 'Competition type updated successfully' });
  } catch (err) {
    console.error('❌ updateCompetitionType error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ============================================
// DELETE COMPETITION TYPE
// ============================================
export const deleteCompetitionType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any competitions use this type
    const [comps] = await db.query(
      `SELECT COUNT(*) AS count FROM competitions WHERE type_id = ?`,
      [id]
    );

    if (comps[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete. ${comps[0].count} competition(s) use this type.`,
      });
    }

    const [result] = await db.query(
      `DELETE FROM competition_types WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Competition type not found' });
    }

    res.json({ success: true, message: 'Competition type deleted successfully' });
  } catch (err) {
    console.error('❌ deleteCompetitionType error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// STATS
// ============================================
export const getCompetitionTypeStats = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) AS total_types,
        COUNT(CASE WHEN img IS NOT NULL AND img != '' THEN 1 END) AS with_images,
        COUNT(CASE WHEN tag IS NOT NULL AND tag != '' THEN 1 END) AS with_tags
      FROM competition_types
    `);

    res.json({ success: true, data: stats[0] });
  } catch (err) {
    console.error('❌ getCompetitionTypeStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};