// controllers/competitionController.js
import db from '../config/db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendDrawNotification } from "../services/email.service.js";
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

// controllers/competitionController.js (or wherever your admin getCompetitions is)
export const getCompetitions = async (req, res) => {
  try {
    // 1. Get all competitions with type + tickets_sold + winners_count
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
        (SELECT COUNT(*) FROM tickets t WHERE t.competition_id = c.id) AS tickets_sold,
        (SELECT COUNT(*) FROM winners w WHERE w.competition_id = c.id) AS winners_count
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      ORDER BY c.id DESC
    `);

    if (rows.length === 0) return res.json([]);

    // 2. Get ALL prizes for these competitions in one query
    const compIds = rows.map((r) => r.id);
    const [prizes] = await db.query(`
      SELECT 
        cp.competition_id,
        cp.procurement_id,
        cp.quantity,
        p.id,
        p.title,
        p.brand,
        p.model,
        p.year,
        p.location,
        p.value,
        p.market_value,
        p.images,
        pc.name AS category_name,
        pc.slug AS category_slug,
        ps.name AS subcategory_name,
        ps.slug AS subcategory_slug
      FROM competition_prizes cp
      JOIN procurements p ON cp.procurement_id = p.id
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE cp.competition_id IN (?)
      ORDER BY cp.id ASC
    `, [compIds]);

    // Safe JSON parse
    const safeParse = (val, fallback = []) => {
      if (!val) return fallback;
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return fallback;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [val];
      }
    };

    // 3. Group prizes by competition
    const prizeMap = {};
    prizes.forEach((p) => {
      if (!prizeMap[p.competition_id]) prizeMap[p.competition_id] = [];
      prizeMap[p.competition_id].push({
        procurement_id: p.procurement_id,
        quantity: p.quantity,
        title: p.title,
        brand: p.brand,
        model: p.model,
        year: p.year,
        location: p.location,
        value: p.value,
        market_value: p.market_value,
        images: safeParse(p.images, []),
        category_name: p.category_name,
        category_slug: p.category_slug,
        subcategory_name: p.subcategory_name,
        subcategory_slug: p.subcategory_slug,
      });
    });

    // 4. Attach prizes + legacy fallback fields
    const data = rows.map((c) => {
      const compPrizes = prizeMap[c.id] || [];
      const firstPrize = compPrizes[0] || null;

      return {
        ...c,
        images: safeParse(c.images, []),
        prizes: compPrizes,
        prize_count: compPrizes.length,

        // ✅ Legacy / backward-compatible fields (used by List page)
        procurement_id: firstPrize?.procurement_id || null,
        procurement_title: firstPrize?.title || null,
        procurement_brand: firstPrize?.brand || null,
        procurement_model: firstPrize?.model || null,
        procurement_value: firstPrize?.value || null,
        procurement_images: firstPrize?.images || [],
        procurement_category_name: firstPrize?.category_name || null,
      };
    });

    res.json(data);
  } catch (err) {
    console.error('❌ Get Competitions Error:', err);
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
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      title, type_id, prizes,        // ✅ prizes = [{ procurement_id, quantity }]
      description, start_date, end_date,
      entry_fee, total_participants, total_winners = 1, status = 'Active',
    } = req.body;

    // Normalize prizes
    let prizeList = [];
    if (typeof prizes === 'string') {
      try { prizeList = JSON.parse(prizes); } catch { prizeList = []; }
    } else if (Array.isArray(prizes)) {
      prizeList = prizes;
    }

    if (!title || !type_id || prizeList.length === 0 || !start_date || !end_date || !entry_fee) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate & check stock
    const procurementIds = prizeList.map((p) => Number(p.procurement_id));
    const [procs] = await connection.query(
      `SELECT id, title, available_quantity FROM procurements WHERE id IN (?)`,
      [procurementIds]
    );

    if (procs.length !== procurementIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Some procurements not found' });
    }

    for (const prize of prizeList) {
      const proc = procs.find((p) => p.id === Number(prize.procurement_id));
      const qty = Number(prize.quantity) || 1;
      if (qty > (proc.available_quantity || 0)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `"${proc.title}" only has ${proc.available_quantity} available, but you requested ${qty}`,
        });
      }
    }

    const imageFilenames = req.files
      ? JSON.stringify(req.files.map((f) => f.filename))
      : JSON.stringify([]);

    // Insert competition
    const [result] = await connection.query(
      `INSERT INTO competitions 
       (title, type_id, procurement_id, description, start_date, end_date, entry_fee,
        total_participants, total_winners, status, images) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        parseInt(type_id),
        procurementIds[0],
        description || null,
        start_date, end_date,
        parseFloat(entry_fee),
        parseInt(total_participants) || 100,
        parseInt(total_winners) || 1,
        status,
        imageFilenames,
      ]
    );

    const competitionId = result.insertId;

    // Insert each prize with its own quantity
    const prizeRows = prizeList.map((p) => [
      competitionId,
      Number(p.procurement_id),
      Number(p.quantity) || 1,
    ]);
    await connection.query(
      `INSERT INTO competition_prizes (competition_id, procurement_id, quantity) VALUES ?`,
      [prizeRows]
    );

    // ✅ Deduct per-prize quantity
    for (const p of prizeList) {
      await connection.query(
        `UPDATE procurements 
         SET available_quantity = available_quantity - ?, updated_at = NOW()
         WHERE id = ?`,
        [Number(p.quantity) || 1, Number(p.procurement_id)]
      );
    }

    await connection.commit();
    return res.status(201).json({ success: true, id: competitionId, message: 'Competition created' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    return res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally {
    connection.release();
  }
};


// Update competition
// controllers/competitionController.js
export const updateCompetition = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      title,
      type_id,
      procurement_ids,
      description,
      start_date,
      end_date,
      entry_fee,
      total_participants,
      total_winners = 1,
      status,
    } = req.body;

    // Normalize ids
    let newProcurementIds = [];
    if (Array.isArray(procurement_ids)) {
      newProcurementIds = procurement_ids;
    } else if (typeof procurement_ids === 'string') {
      try {
        newProcurementIds = JSON.parse(procurement_ids);
      } catch {
        newProcurementIds = procurement_ids.split(',').map((s) => s.trim());
      }
    }
    newProcurementIds = [...new Set(newProcurementIds.filter(Boolean).map(Number))];

    const winnersCount = parseInt(total_winners) || 1;

    // Get existing linked prizes
    const [existingPrizes] = await connection.query(
      `SELECT procurement_id FROM competition_prizes WHERE competition_id = ?`,
      [id]
    );
    const existingIds = existingPrizes.map((p) => p.procurement_id);

    // Determine removed + added
    const removed = existingIds.filter((pid) => !newProcurementIds.includes(pid));
    const added = newProcurementIds.filter((pid) => !existingIds.includes(pid));

    // Validate added procurements have stock
    if (added.length > 0) {
      const [procs] = await connection.query(
        `SELECT id, title, available_quantity FROM procurements WHERE id IN (?)`,
        [added]
      );

      const insufficient = procs.filter((p) => (p.available_quantity || 0) < winnersCount);
      if (insufficient.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Not enough stock. ${insufficient
            .map((p) => `"${p.title}" has ${p.available_quantity}, need ${winnersCount}`)
            .join('; ')}`,
        });
      }
    }

    // ✅ Restore stock for removed prizes
    if (removed.length > 0) {
      await connection.query(
        `UPDATE procurements 
         SET available_quantity = available_quantity + ?, updated_at = NOW()
         WHERE id IN (?)`,
        [winnersCount, removed]
      );
    }

    // ✅ Deduct stock for added prizes
    if (added.length > 0) {
      await connection.query(
        `UPDATE procurements 
         SET available_quantity = available_quantity - ?, updated_at = NOW()
         WHERE id IN (?)`,
        [winnersCount, added]
      );
    }

    // ✅ Refresh junction table
    if (removed.length > 0 || added.length > 0) {
      await connection.query(
        `DELETE FROM competition_prizes WHERE competition_id = ? AND procurement_id IN (?)`,
        [id, removed.length > 0 ? removed : [0]]
      );

      if (added.length > 0) {
        const rows = added.map((pid) => [id, pid, winnersCount]);
        await connection.query(
          `INSERT INTO competition_prizes (competition_id, procurement_id, quantity) VALUES ?`,
          [rows]
        );
      }

      // Update quantity for existing that stayed
      await connection.query(
        `UPDATE competition_prizes SET quantity = ? WHERE competition_id = ?`,
        [winnersCount, id]
      );
    }

    // ✅ Update the competition row
    const updates = {
      title,
      type_id,
      procurement_id: newProcurementIds[0] || null,
      description,
      start_date,
      end_date,
      entry_fee,
      total_participants,
      total_winners: winnersCount,
      status,
    };

    const updateFields = [];
    const values = [];
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        updateFields.push(`${k} = ?`);
        values.push(v);
      }
    }

    // Handle images
    if (req.files && req.files.length > 0) {
      updateFields.push(`images = ?`);
      values.push(JSON.stringify(req.files.map((f) => f.filename)));
    }

    values.push(id);
    await connection.query(
      `UPDATE competitions SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    await connection.commit();

    console.log(`✅ Competition ${id} updated. Removed: ${removed.length}, Added: ${added.length}`);

    return res.json({ success: true, message: 'Competition updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('❌ UPDATE COMPETITION ERROR:', err);
    return res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally {
    connection.release();
  }
};

// Delete competition - restore stock
// controllers/competitionController.js
export const deleteCompetition = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Get linked prizes
    const [prizes] = await connection.query(
      `SELECT procurement_id, quantity FROM competition_prizes WHERE competition_id = ?`,
      [id]
    );

    // Get competition (fallback)
    const [comp] = await connection.query(
      `SELECT procurement_id, total_winners FROM competitions WHERE id = ?`,
      [id]
    );

    // Restore stock for each linked procurement
    if (prizes.length > 0) {
      for (const p of prizes) {
        await connection.query(
          `UPDATE procurements 
           SET available_quantity = available_quantity + ?, updated_at = NOW()
           WHERE id = ?`,
          [p.quantity || 1, p.procurement_id]
        );
      }
    } else if (comp.length > 0 && comp[0].procurement_id) {
      // Fallback for old competitions without junction entries
      await connection.query(
        `UPDATE procurements 
         SET available_quantity = available_quantity + ?, updated_at = NOW()
         WHERE id = ?`,
        [comp[0].total_winners || 1, comp[0].procurement_id]
      );
    }

    // Delete competition (junction rows cascade)
    await connection.query(`DELETE FROM competitions WHERE id = ?`, [id]);

    await connection.commit();
    res.json({ success: true, message: 'Competition deleted and stock restored' });
  } catch (err) {
    await connection.rollback();
    console.error('❌ DELETE COMPETITION ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
};

// Get competition full details
export const getCompetitionFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // ============================================
    // 1. GET COMPETITION BASE INFO
    // ============================================
    const [comp] = await db.query(`
      SELECT 
        c.*,
        ct.id AS type_id,
        ct.name AS competition_type_name,
        ct.type_name AS competition_type,
        ct.bgcolor AS competition_color,
        ct.img AS competition_type_image
      FROM competitions c
      LEFT JOIN competition_types ct ON c.type_id = ct.id
      WHERE c.id = ?
    `, [id]);

    if (!comp.length) {
      return res.status(404).json({ message: 'Competition not found' });
    }

    // ============================================
    // 2. GET ALL LINKED PRIZES (junction table)
    // ============================================
    const [prizes] = await db.query(`
      SELECT 
        cp.procurement_id,
        cp.quantity,
        p.id,
        p.title,
        p.description,
        p.brand,
        p.model,
        p.year,
        p.location,
        p.value,
        p.market_value,
        p.purchase_price,
        p.available_quantity,
        p.quantity AS total_quantity,
        p.images,
        p.attributes,
        pc.id AS category_id,
        pc.name AS category_name,
        pc.slug AS category_slug,
        ps.id AS subcategory_id,
        ps.name AS subcategory_name,
        ps.slug AS subcategory_slug
      FROM competition_prizes cp
      JOIN procurements p ON cp.procurement_id = p.id
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE cp.competition_id = ?
      ORDER BY cp.id ASC
    `, [id]);

    // ============================================
    // 3. GET ALL TICKETS
    // ============================================
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

    // ============================================
    // 4. GET ALL WINNERS
    // ============================================
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

    // Fallback: winners from tickets.is_winner
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

    // ============================================
    // 5. BUILD RESPONSE
    // ============================================
    const compData = comp[0];
    compData.images = safeParseJSON(compData.images, []);

    // Parse prize images & attributes
    const parsedPrizes = prizes.map((p) => ({
      procurement_id: p.procurement_id,
      quantity: p.quantity || 1,
      id: p.id,
      title: p.title,
      description: p.description,
      brand: p.brand,
      model: p.model,
      year: p.year,
      location: p.location,
      value: p.value,
      market_value: p.market_value,
      purchase_price: p.purchase_price,
      available_quantity: p.available_quantity,
      total_quantity: p.total_quantity,
      images: safeParseJSON(p.images, []),
      attributes: safeParseJSON(p.attributes, {}),
      category_id: p.category_id,
      category_name: p.category_name,
      category_slug: p.category_slug,
      subcategory_id: p.subcategory_id,
      subcategory_name: p.subcategory_name,
      subcategory_slug: p.subcategory_slug,
    }));

    // Legacy fields (first prize) for backward compatibility
    const firstPrize = parsedPrizes[0] || null;
    compData.procurement_id = firstPrize?.procurement_id || null;
    compData.procurement_title = firstPrize?.title || null;
    compData.procurement_brand = firstPrize?.brand || null;
    compData.procurement_model = firstPrize?.model || null;
    compData.procurement_value = firstPrize?.value || null;
    compData.procurement_market_value = firstPrize?.market_value || null;
    compData.procurement_images = firstPrize?.images || [];
    compData.procurement_category_name = firstPrize?.category_name || null;
    compData.procurement_subcategory_name = firstPrize?.subcategory_name || null;
    compData.procurement_available = firstPrize?.available_quantity || 0;

    // Combine winners
    let allWinners = winners.length > 0
      ? winners
      : ticketWinners.map((tw) => ({
          name: tw.name,
          user_name: tw.name,
          user_email: tw.user_email,
          ticket_number: tw.ticket_number,
          user_id: tw.user_id,
          status: 'pending',
        }));

    res.json({
      competition: compData,
      prizes: parsedPrizes,       // ✅ NEW — all linked prizes
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
    const [availableTickets] = await connection.query(
      `
      SELECT t.id, t.ticket_number, t.user_id
      FROM tickets t
      WHERE t.competition_id = ?
        AND t.is_winner = 0
        AND t.user_id NOT IN (
          SELECT DISTINCT w.user_id 
          FROM winners w 
          WHERE w.competition_id = ?
        )
    `,
      [id, id]
    );

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
    await connection.query(
      `
      INSERT INTO winners (user_id, competition_id, ticket_id, status, won_at, created_at) 
      VALUES (?, ?, ?, 'pending', NOW(), NOW())
    `,
      [winningTicket.user_id, id, winningTicket.id]
    );

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

    // ✅ Fetch prize name for the email (from first linked prize)
    const [prizeRows] = await connection.query(
      `SELECT p.title AS prize_name
       FROM competition_prizes cp
       JOIN procurements p ON cp.procurement_id = p.id
       WHERE cp.competition_id = ?
       ORDER BY cp.id ASC
       LIMIT 1`,
      [id]
    );

    const prizeName =
      prizeRows[0]?.prize_name ||
      competition.title ||
      'the prize';

    // ✅ Commit DB transaction BEFORE sending emails
    //    (so slow SMTP never blocks the lock)
    await connection.commit();

    console.log(
      `🎉 Winner ${newWinnersDrawn}/${totalWinners} drawn for competition ${id}`
    );

    // ============================================
    // ✅ EMAIL NOTIFICATIONS (non-blocking)
    // ============================================
    // Run AFTER commit so email failures don't rollback the draw.
    try {
      // Fetch all unique participants (for "results in" email)
      const [participants] = await db.query(
        `SELECT DISTINCT u.Id AS id, u.name, u.email
         FROM users u
         JOIN tickets t ON t.user_id = u.Id
         WHERE t.competition_id = ?`,
        [id]
      );

      const winner = winnerDetails[0] || null;

      const info = {
        title: competition.title || 'Competition',
        drawDate: new Date().toLocaleString(),
        prizeName,
        winnerName: winner?.name || 'See live draw',
        resultsUrl: 'https://www.keboka.com/winners',
      };

      for (const p of participants) {
        try {
          await sendDrawNotification(p.email, p.name, {
            ...info,
            // Only the actual winner gets the "You won!" template
            isWinner: p.id === winningTicket.user_id,
          });
        } catch (err) {
          console.error(`⚠️ Draw email failed for ${p.email}:`, err.message);
        }
      }

      console.log(
        `📧 Draw notification sent to ${participants.length} participant(s)`
      );
    } catch (emailErr) {
      console.error('⚠️ Draw email batch failed:', emailErr.message);
    }

    return res.json({
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