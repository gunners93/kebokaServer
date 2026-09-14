// controllers/competitionController.js
import db from '../config/db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
// MULTER CONFIG
// ============================================
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `competition-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadMiddleware = upload.array('images', 10);

// ============================================
// COMPETITION TYPES
// ============================================
export const getCompetitionTypes = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM competition_types ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('❌ getCompetitionTypes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================================
// COMPETITIONS
// ============================================

// Get all competitions
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
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.year AS procurement_year,
        p.location AS procurement_location,
        p.value AS procurement_value,
        p.available_quantity AS procurement_available,
        p.images AS procurement_images,
        p.category_id AS procurement_category_id,
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

    const data = rows.map(c => ({
      ...c,
      images: safeParseJSON(c.images, []),
      procurement_images: safeParseJSON(c.procurement_images, []),
      competitions_title: c.title,
      competition_id: c.id,
    }));

    res.json(data);
  } catch (err) {
    console.error('Get Competitions Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single competition
export const getCompetition = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT 
        c.*,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        p.id AS procurement_id,
        p.title AS procurement_title,
        p.brand AS procurement_brand,
        p.model AS procurement_model,
        p.value AS procurement_value,
        p.available_quantity AS procurement_available,
        p.images AS procurement_images
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      WHERE c.id = ?
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Competition not found' });
    }

    const comp = rows[0];
    comp.images = safeParseJSON(comp.images, []);
    comp.procurement_images = safeParseJSON(comp.procurement_images, []);

    res.json(comp);
  } catch (err) {
    console.error('Get Competition Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create competition
export const createCompetition = async (req, res) => {
  try {
    console.log('📥 Create Competition Body:', req.body);

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

    // Validate
    if (!title || !type_id || !procurement_id || !start_date || !end_date || !entry_fee) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if procurement has enough available quantity
    const [procurement] = await db.query(
      'SELECT id, title, available_quantity, quantity FROM procurements WHERE id = ?',
      [procurement_id]
    );

    if (!procurement.length) {
      return res.status(404).json({ message: 'Procurement not found' });
    }

    const winnersCount = parseInt(total_winners) || 1;
    const availableQty = procurement[0].available_quantity || 0;

    if (winnersCount > availableQty) {
      return res.status(400).json({
        message: `Not enough items in stock. Only ${availableQty} available but ${winnersCount} winners requested.`,
        available: availableQty,
        requested: winnersCount,
      });
    }

    const imageFilenames = req.files
      ? JSON.stringify(req.files.map(f => f.filename))
      : JSON.stringify([]);

    // Create competition
    const [result] = await db.query(`
      INSERT INTO competitions 
      (title, type_id, procurement_id, description, start_date, end_date, entry_fee, total_participants, total_winners, status, images) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      type_id,
      procurement_id,
      description || null,
      start_date,
      end_date,
      entry_fee,
      total_participants || 100,
      winnersCount,
      status,
      imageFilenames
    ]);

    // ✅ Deduct winners from procurement available_quantity
    await db.query(`
      UPDATE procurements 
      SET available_quantity = available_quantity - ?,
          updated_at = NOW()
      WHERE id = ?
    `, [winnersCount, procurement_id]);

    console.log(`✅ Deducted ${winnersCount} from procurement ${procurement_id}. Remaining: ${availableQty - winnersCount}`);

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Competition created successfully',
      procurement_remaining: availableQty - winnersCount,
    });
  } catch (err) {
    console.error('Create Competition Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Update competition
export const updateCompetition = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      type_id,
      procurement_id,
      description,
      start_date,
      end_date,
      entry_fee,
      total_participants,
      total_winners,
      status,
    } = req.body;

    // Get existing competition to check if procurement/winners changed
    const [existing] = await db.query('SELECT * FROM competitions WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Competition not found' });
    }

    const oldProcurementId = existing[0].procurement_id;
    const oldWinners = existing[0].total_winners || 1;
    const newWinners = parseInt(total_winners) || 1;
    const newProcurementId = procurement_id || oldProcurementId;

    // If procurement or winners changed, adjust stock
    if (oldProcurementId != newProcurementId || oldWinners !== newWinners) {
      // Restore old procurement
      await db.query(`
        UPDATE procurements 
        SET available_quantity = available_quantity + ?
        WHERE id = ?
      `, [oldWinners, oldProcurementId]);

      // Deduct from new procurement
      const [procurement] = await db.query(
        'SELECT available_quantity FROM procurements WHERE id = ?',
        [newProcurementId]
      );

      if (procurement.length && newWinners > procurement[0].available_quantity) {
        // Rollback
        await db.query(`
          UPDATE procurements 
          SET available_quantity = available_quantity - ?
          WHERE id = ?
        `, [oldWinners, oldProcurementId]);

        return res.status(400).json({
          message: `Not enough items. Only ${procurement[0].available_quantity} available.`,
        });
      }

      await db.query(`
        UPDATE procurements 
        SET available_quantity = available_quantity - ?
        WHERE id = ?
      `, [newWinners, newProcurementId]);
    }

    let query = `
      UPDATE competitions 
      SET title=?, type_id=?, procurement_id=?, description=?, 
          start_date=?, end_date=?, entry_fee=?, total_participants=?, 
          total_winners=?, status=?
    `;
    const params = [
      title, type_id, newProcurementId, description, start_date, end_date,
      entry_fee, total_participants, newWinners, status
    ];

    if (req.files && req.files.length > 0) {
      const imageFilenames = JSON.stringify(req.files.map(f => f.filename));
      query += `, images=?`;
      params.push(imageFilenames);
    }

    query += ` WHERE id=?`;
    params.push(id);

    await db.query(query, params);

    res.json({ success: true, message: 'Competition updated successfully' });
  } catch (err) {
    console.error('Update Competition Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Delete competition - restore stock
export const deleteCompetition = async (req, res) => {
  try {
    const { id } = req.params;

    // Get competition to restore stock
    const [comp] = await db.query('SELECT * FROM competitions WHERE id = ?', [id]);
    
    if (comp.length && comp[0].procurement_id) {
      const winnersToRestore = comp[0].total_winners || 1;
      await db.query(`
        UPDATE procurements 
        SET available_quantity = available_quantity + ?
        WHERE id = ?
      `, [winnersToRestore, comp[0].procurement_id]);

      console.log(`♻️ Restored ${winnersToRestore} to procurement ${comp[0].procurement_id}`);
    }

    await db.query('DELETE FROM competitions WHERE id=?', [id]);
    res.json({ success: true, message: 'Competition deleted successfully' });
  } catch (err) {
    console.error('Delete Competition Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get competition full details
export const getCompetitionFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

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
        ps.slug AS procurement_subcategory_slug
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      LEFT JOIN procurements p ON c.procurement_id = p.id
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE c.id = ?
    `, [id]);

    if (!comp.length) {
      return res.status(404).json({ message: 'Competition not found' });
    }

    // Get all tickets
    const [tickets] = await db.query(`
      SELECT 
        t.*,
        u.name AS name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM tickets t
      JOIN users u ON t.user_id = u.Id
      WHERE t.competition_id = ?
      ORDER BY t.created_at DESC
    `, [id]);

    // Get all winners for this competition
    const [winners] = await db.query(`
      SELECT 
        w.*,
        u.name AS name,
        u.email AS user_email,
        u.phone AS user_phone,
        t.ticket_number
      FROM winners w
      JOIN users u ON w.user_id = u.Id
      LEFT JOIN tickets t ON w.ticket_id = t.id
      WHERE w.competition_id = ?
      ORDER BY w.won_at ASC
    `, [id]);

    // Also get winners from tickets.is_winner as fallback
    const [ticketWinners] = await db.query(`
      SELECT 
        t.id,
        t.ticket_number,
        t.user_id,
        t.is_winner,
        u.name AS name,
        u.email AS user_email
      FROM tickets t
      JOIN users u ON t.user_id = u.Id
      WHERE t.competition_id = ? AND t.is_winner = 1
    `, [id]);

    const compData = comp[0];
    compData.images = safeParseJSON(compData.images, []);
    compData.procurement_images = safeParseJSON(compData.procurement_images, []);

    // Combine winners from both tables
    let allWinners = winners.length > 0 ? winners : ticketWinners.map(tw => ({
      name: tw.name,
      user_email: tw.user_email,
      ticket_number: tw.ticket_number,
      user_id: tw.user_id,
      status: 'pending',
    }));

    res.json({
      competition: compData,
      tickets,
      winners: allWinners,
      winner: allWinners[0] || null, // backward compatibility
      total_winners: compData.total_winners || 1,
      winners_drawn: allWinners.length,
    });
  } catch (err) {
    console.error('Get Competition Details Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Draw winner(s) - One at a time, no duplicates
export const drawCompetitionWinner = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Get competition details
    const [comp] = await connection.query(
      'SELECT * FROM competitions WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!comp.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Competition not found' });
    }

    const competition = comp[0];
    const totalWinners = competition.total_winners || 1;
    const winnersDrawn = competition.winners_drawn || 0;

    // Check if all winners have been drawn
    if (winnersDrawn >= totalWinners) {
      await connection.rollback();
      return res.status(400).json({
        message: `All ${totalWinners} winner(s) have already been drawn for this competition.`,
        total_winners: totalWinners,
        winners_drawn: winnersDrawn,
      });
    }

    // Get all tickets that haven't won yet (no duplicate winners)
    const [availableTickets] = await connection.query(`
      SELECT t.id, t.ticket_number, t.user_id
      FROM tickets t
      WHERE t.competition_id = ?
        AND t.is_winner = 0
        AND t.user_id NOT IN (
          SELECT DISTINCT w.user_id 
          FROM winners w 
          WHERE w.competition_id = ?
        )
    `, [id, id]);

    if (availableTickets.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'No eligible tickets remain. All participants have already won.',
      });
    }

    // Pick a random winner
    const randomIndex = Math.floor(Math.random() * availableTickets.length);
    const winningTicket = availableTickets[randomIndex];

    // Mark ticket as winner
    await connection.query(
      'UPDATE tickets SET is_winner = 1 WHERE id = ?',
      [winningTicket.id]
    );

    // Create winner record
    await connection.query(`
      INSERT INTO winners (user_id, competition_id, ticket_id, status, won_at, created_at) 
      VALUES (?, ?, ?, 'pending', NOW(), NOW())
    `, [winningTicket.user_id, id, winningTicket.id]);

    // Update winners_drawn count
    const newWinnersDrawn = winnersDrawn + 1;
    await connection.query(
      'UPDATE competitions SET winners_drawn = ? WHERE id = ?',
      [newWinnersDrawn, id]
    );

    // If all winners have been drawn, close the competition
    if (newWinnersDrawn >= totalWinners) {
      await connection.query(
        "UPDATE competitions SET status = 'Closed' WHERE id = ?",
        [id]
      );
    }

    // Get winner details
    const [winnerDetails] = await connection.query(
      'SELECT name, email FROM users WHERE Id = ?',
      [winningTicket.user_id]
    );

    await connection.commit();

    console.log(`🎉 Winner ${newWinnersDrawn}/${totalWinners} drawn for competition ${id}`);

    res.json({
      success: true,
      message: `Winner ${newWinnersDrawn}/${totalWinners} drawn successfully!`,
      winner: {
        name: winnerDetails[0]?.name || 'Unknown',
        email: winnerDetails[0]?.email,
        ticket: winningTicket.ticket_number,
      },
      progress: {
        current: newWinnersDrawn,
        total: totalWinners,
        remaining: totalWinners - newWinnersDrawn,
        is_complete: newWinnersDrawn >= totalWinners,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('Draw Winner Error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};