// jobs/drawCronJob.js
import cron from 'node-cron';
import db from '../config/db.js';
import { drawCompetitionWinnerByCornJob } from '../controllers/competitionController.js';

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  // Delay after end_date before starting the draw (in minutes)
  DRAW_DELAY_MINUTES: 5,
  // Time between each winner in the same competition (in minutes)
  WINNER_INTERVAL_MINUTES: 2,
  // Max winners to draw per cron run (safety)
  MAX_DRAWS_PER_RUN: 10,
};

// ============================================
// FIND COMPETITIONS READY TO DRAW
// ============================================
const getCompetitionsReadyToDraw = async () => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        c.id,
        c.title,
        c.end_date,
        c.total_winners,
        c.winners_drawn,
        c.status
      FROM competitions c
      WHERE 
        -- competition has ended + grace delay has passed
        c.end_date <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        -- not fully closed yet
        AND c.status NOT IN ('Closed', 'closed')
        -- still has winners left to draw
        AND COALESCE(c.winners_drawn, 0) < COALESCE(c.total_winners, 1)
        -- has at least one ticket
        AND EXISTS (
          SELECT 1 FROM tickets t 
          WHERE t.competition_id = c.id AND t.is_winner = 0
        )
        -- last winner for this competition was drawn > N minutes ago
        AND (
          c.winners_drawn = 0
          OR c.updated_at IS NULL
          OR c.updated_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        )
      ORDER BY c.end_date ASC
      LIMIT ?
    `,
      [
        CONFIG.DRAW_DELAY_MINUTES,
        CONFIG.WINNER_INTERVAL_MINUTES,
        CONFIG.MAX_DRAWS_PER_RUN,
      ]
    );

    return rows;
  } catch (err) {
    console.error('❌ [CRON] Failed to fetch ready competitions:', err);
    return [];
  }
};

// ============================================
// THE MAIN CRON TASK
// ============================================
const runDrawSweep = async () => {
  console.log(`\n🤖 [CRON] Draw sweep starting at ${new Date().toISOString()}`);

  try {
    const competitions = await getCompetitionsReadyToDraw();

    if (competitions.length === 0) {
      console.log('🤖 [CRON] No competitions ready to draw.');
      return;
    }

    console.log(`🤖 [CRON] Found ${competitions.length} competition(s) ready.`);

    for (const comp of competitions) {
      console.log(
        `\n🎯 [CRON] Drawing for #${comp.id} "${comp.title}" ` +
          `(${comp.winners_drawn}/${comp.total_winners} drawn)`
      );

      const result = await drawCompetitionWinnerByCornJob(comp.id);

      if (result.success) {
        console.log(
          `✅ [CRON] Winner drawn: ${result.winner.name} ` +
            `(${result.progress.current}/${result.progress.total})`
        );
        console.log(
          `   → Ticket: ${result.winner.ticket} | Email: ${result.winner.email}`
        );
      } else {
        console.log(`⚠️ [CRON] Draw skipped: ${result.reason}`);
      }
    }
  } catch (err) {
    console.error('❌ [CRON] Sweep error:', err);
  }

  console.log(`🤖 [CRON] Sweep complete at ${new Date().toISOString()}\n`);
};

// ============================================
// START THE CRON JOB
// ============================================
export const startDrawCron = () => {
  // Run every minute
  const task = cron.schedule('* * * * *', runDrawSweep, {
    scheduled: true,
    timezone: 'Africa/Lagos', // 👈 your timezone
  });

  console.log('🕒 [CRON] Draw cron job started (every 1 minute).');

  // Optional: run once on startup (5 seconds after boot)
  setTimeout(() => {
    console.log('🕒 [CRON] Running initial sweep on startup...');
    runDrawSweep();
  }, 5000);

  return task;
};

// Export the sweep function directly for manual testing
export { runDrawSweep };