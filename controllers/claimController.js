// controllers/claimController.js
import db from '../config/db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Multer config for claim media
const uploadDir = path.join(process.cwd(), 'uploads', 'claims');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `claim-${suffix}${path.extname(file.originalname)}`);
  },
});

export const uploadClaimMedia = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'video', maxCount: 1 },
]);

// ============================================
// GET winner claim details
// GET /api/v2/claims/:winnerId
// ============================================
export const getClaimDetails = async (req, res) => {
  try {
    const { winnerId } = req.params;
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT 
        w.*,
        c.title AS competition_title,
        c.has_cash_alternative,
        c.cash_alternative_amount,
        c.images AS competition_images,
        c.entry_fee,
        u.name AS user_name,
        u.phone AS user_phone,
        t.ticket_number
      FROM winners w
      JOIN competitions c ON c.id = w.competition_id
      JOIN users u ON u.Id = w.user_id
      LEFT JOIN tickets t ON t.id = w.ticket_id
      WHERE w.ticket_id = ? AND w.user_id = ?`,
      [winnerId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Winner record not found' });
    }

    const [claimRows] = await db.query(
      `SELECT * FROM winner_claims WHERE winner_id = ? LIMIT 1`,
      [winnerId]
    );

    const winner = rows[0];
    const safeParse = (v) => {
      if (!v) return [];
      try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return []; }
    };

    res.json({
      success: true,
      data: {
        winner: {
          ...winner,
          competition_images: safeParse(winner.competition_images),
        },
        claim: claimRows.length ? {
          ...claimRows[0],
          media_images: safeParse(claimRows[0].media_images),
        } : null,
      },
    });
  } catch (err) {
    console.error('getClaimDetails error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// SUBMIT CLAIM
// POST /api/v2/claims/:winnerId
// ============================================
// controllers/claimController.js

export const submitClaim = async (req, res) => {
  try {
    // NOTE: winnerId here is actually the ticket_id based on your frontend
    const { winnerId } = req.params; 
    const userId = req.user.id;

    const {
      full_name,
      phone_number,
      alternative_phone,
      pickup_option,
      house_number,
      street_name,
      lga,
      state,
      country,
      delivery_instruction,
    } = req.body;

    if (!full_name || !phone_number || !pickup_option) {
      return res.status(400).json({
        success: false,
        message: 'Full name, phone, and pickup option are required',
      });
    }

    // 1. Verify winner belongs to this user (using ticket_id)
    const [wRows] = await db.query(
      `SELECT id, competition_id, status, claim_status FROM winners WHERE ticket_id = ? AND user_id = ?`,
      [winnerId, userId]
    );
    
    if (!wRows.length) {
      return res.status(404).json({ success: false, message: 'Winner not found' });
    }

    const winner = wRows[0];
    const actualWinnerId = winner.id; // This is the real winners.id

    // Prevent updates if already delivered/confirmed
    if (['delivered', 'confirmed'].includes(winner.claim_status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prize already claimed and delivered.' 
      });
    }

    // 2. Check if a claim already exists for this winner
    const [existingClaim] = await db.query(
      `SELECT id FROM winner_claims WHERE winner_id = ? LIMIT 1`,
      [actualWinnerId]
    );

    if (existingClaim.length > 0) {
      // ✅ 3. UPDATE existing claim (Prevents duplicates)
      await db.query(
        `UPDATE winner_claims SET
           full_name = ?, phone_number = ?, alternative_phone = ?,
           house_number = ?, street_name = ?, lga = ?, state = ?, 
           country = ?, delivery_instruction = ?, updated_at = NOW()
         WHERE winner_id = ?`,
        [
          full_name, phone_number, alternative_phone || null,
          house_number || null, street_name || null, lga || null,
          state || null, country || 'Nigeria', delivery_instruction || null,
          actualWinnerId
        ]
      );
    } else {
      // ✅ 4. INSERT new claim
      await db.query(
        `INSERT INTO winner_claims 
          (winner_id, user_id, competition_id, full_name, phone_number, alternative_phone,
           house_number, street_name, lga, state, country, delivery_instruction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualWinnerId, userId, winner.competition_id,
          full_name, phone_number, alternative_phone || null,
          house_number || null, street_name || null, lga || null,
          state || null, country || 'Nigeria', delivery_instruction || null,
        ]
      );
    }

    // 5. Update winner status
    if (winner.claim_status === 'pending' || !winner.claim_status) {
      await db.query(
        `UPDATE winners SET claim_status = 'claiming', pickup_option = ?, claim_submitted_at = NOW() WHERE id = ?`,
        [pickup_option, actualWinnerId]
      );
    } else {
      await db.query(
        `UPDATE winners SET pickup_option = ? WHERE id = ?`,
        [pickup_option, actualWinnerId]
      );
    }

    res.json({
      success: true,
      message: pickup_option === 'pickup'
        ? 'Our Customer Representative will be in touch with you soon.'
        : 'We will now proceed to process prize delivery within 7 days.',
      claim_status: 'claiming',
    });
  } catch (err) {
    console.error('submitClaim error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// SUBMIT FEEDBACK + MEDIA
// POST /api/v2/claims/:winnerId/feedback
// ============================================
export const submitFeedback = async (req, res) => {
  try {
    const { winnerId } = req.params;
    const userId = req.user.id;
    const {
      feedback_type,
      instagram,
      facebook,
      twitter,
      tiktok,
    } = req.body;

    const files = req.files || {};
    const imageFiles = files.images ? files.images.map((f) => f.filename) : [];
    const videoFile = files.video ? files.video[0].filename : null;

    await db.query(
      `UPDATE winner_claims SET
         feedback_type = ?,
         instagram = ?,
         facebook = ?,
         twitter = ?,
         tiktok = ?,
         media_images = ?,
         media_video = ?
       WHERE winner_id = ? AND user_id = ?`,
      [
        feedback_type || null,
        instagram || null,
        facebook || null,
        twitter || null,
        tiktok || null,
        JSON.stringify(imageFiles),
        videoFile,
        winnerId,
        userId,
      ]
    );

    await db.query(
      `UPDATE winners SET claim_status = 'delivered', delivered_at = NOW() WHERE id = ? AND user_id = ?`,
      [winnerId, userId]
    );

    res.json({
      success: true,
      message: 'Thank you for your feedback! Your prize delivery is now complete.',
    });
  } catch (err) {
    console.error('submitFeedback error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// CONFIRM DELIVERY (user)
// POST /api/v2/claims/:winnerId/confirm-delivery
// ============================================
export const confirmDelivery = async (req, res) => {
  try {
    const { winnerId } = req.params; // Actually ticket_id
    const userId = req.user.id;

    const [result] = await db.query(
      `UPDATE winners SET claim_status = 'confirmed', confirmed_at = NOW()
       WHERE ticket_id = ? AND user_id = ? AND claim_status IN ('dispatched', 'delivered')`,
      [winnerId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm — prize is not yet dispatched or already confirmed.',
      });
    }

    res.json({ success: true, message: 'Prize delivery confirmed. Thank you!' });
  } catch (err) {
    console.error('confirmDelivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// ADMIN: Mark dispatched + set tracking number
// POST /api/v2/admin/claims/:winnerId/dispatch
// ============================================
export const markDispatched = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const { winnerId } = req.params;
    const { tracking_number } = req.body;

    if (!tracking_number) {
      return res.status(400).json({ success: false, message: 'Tracking number required' });
    }

    await db.query(
      `UPDATE winners SET claim_status = 'dispatched', tracking_number = ?, dispatched_at = NOW() WHERE id = ?`,
      [tracking_number, winnerId]
    );

    res.json({ success: true, message: 'Marked as dispatched' });
  } catch (err) {
    console.error('markDispatched error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// AUTO-CONFIRM DELIVERY (cron)
// ============================================
export const autoConfirmDeliveries = async () => {
  try {
    const [result] = await db.query(
      `UPDATE winners
       SET claim_status = 'confirmed', confirmed_at = NOW()
       WHERE claim_status = 'dispatched'
         AND delivered_at IS NULL
         AND dispatched_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)`
    );
    if (result.affectedRows > 0) {
      console.log(`🤖 [AUTO-CONFIRM] Confirmed ${result.affectedRows} deliveries`);
    }
  } catch (err) {
    console.error('autoConfirmDeliveries error:', err);
  }
};