import { transporter } from "../config/email.js";

const FROM = `"Keboka" <admin@keboka.com>`;
const SUPPORT_EMAIL = "support@keboka.com";
const WEBSITE = "https://www.keboka.com";

// Brand palette (matches BOTB)
const C = {
  orange: "#F58220",
  orangeDark: "#E06D0A",
  navy: "#1B2A4E",
  yellow: "#FFE600",
  lightBg: "#F7F7F7",
  text: "#333333",
  muted: "#777777",
};

// ─────────────────────────────────────────────
// SHARED BUILDING BLOCKS
// ─────────────────────────────────────────────

const ctaButton = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td align="center" style="border-radius:6px;background:${C.orange};">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:14px 42px;font-size:15px;font-weight:bold;
                  color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const promoBanner = () => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${C.navy};border-radius:8px;margin:24px 0;overflow:hidden;">
    <tr>
      <td style="padding:20px;">
        <table role="presentation" width="100%">
          <tr>
            <td style="width:40%;vertical-align:middle;">
              <img src="${WEBSITE}/email/promo-car.png" alt="Keboka Pass"
                   style="width:100%;max-width:180px;display:block;border-radius:6px;" />
            </td>
            <td style="width:60%;padding-left:16px;vertical-align:middle;">
              <div style="background:${C.yellow};color:#000;font-size:11px;font-weight:bold;
                          padding:4px 10px;border-radius:12px;display:inline-block;">
                JUST LAUNCHED
              </div>
              <h3 style="color:#ffffff;margin:10px 0 6px 0;font-size:16px;">
                INTRODUCING KEBOKA PASS
              </h3>
              <p style="color:${C.yellow};margin:0 0 4px 0;font-weight:bold;font-size:14px;">
                The Upgraded Way to Play
              </p>
              <p style="color:#ffffff;margin:0 0 12px 0;font-size:13px;">
                Save up to 72% every single month!
              </p>
              <a href="${WEBSITE}/pass"
                 style="background:${C.orange};color:#fff;padding:10px 22px;border-radius:5px;
                        text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">
                SUBSCRIBE NOW
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const featureIcons = () => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center" width="33%">
        <img src="${WEBSITE}/email/icon-tickets.png" width="60" alt="Competitions" style="display:block;margin:0 auto 8px;" />
        <p style="margin:0;font-size:12px;color:${C.muted};">Competitions</p>
      </td>
      <td align="center" width="33%">
        <img src="${WEBSITE}/email/icon-trophy.png" width="60" alt="Winners" style="display:block;margin:0 auto 8px;" />
        <p style="margin:0;font-size:12px;color:${C.muted};">Winners</p>
      </td>
      <td align="center" width="33%">
        <img src="${WEBSITE}/email/icon-car.png" width="60" alt="Prizes" style="display:block;margin:0 auto 8px;" />
        <p style="margin:0;font-size:12px;color:${C.muted};">Prize Gallery</p>
      </td>
    </tr>
  </table>
`;

const socialIcons = () => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;">
    <tr>
      <td style="padding:0 6px;"><a href="https://facebook.com/keboka"><img src="${WEBSITE}/email/social-fb.png" width="28" alt="Facebook" /></a></td>
      <td style="padding:0 6px;"><a href="https://youtube.com/@keboka"><img src="${WEBSITE}/email/social-yt.png" width="28" alt="YouTube" /></a></td>
      <td style="padding:0 6px;"><a href="https://instagram.com/keboka"><img src="${WEBSITE}/email/social-ig.png" width="28" alt="Instagram" /></a></td>
      <td style="padding:0 6px;"><a href="https://tiktok.com/@keboka"><img src="${WEBSITE}/email/social-tt.png" width="28" alt="TikTok" /></a></td>
    </tr>
  </table>
`;

const footer = () => `
  <tr>
    <td style="padding:24px 32px 32px 32px;background:${C.lightBg};border-top:1px solid #eee;text-align:center;">
      <p style="margin:0 0 8px 0;font-size:12px;color:${C.muted};">
        Hellingwood Limited, Keboka Competitions
      </p>
      <p style="margin:0 0 8px 0;font-size:12px;color:${C.muted};">
        Lagos, Nigeria
      </p>
      <p style="margin:0 0 16px 0;font-size:12px;">
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.orange};text-decoration:none;">${SUPPORT_EMAIL}</a>
        &nbsp;|&nbsp;
        <a href="${WEBSITE}/terms" style="color:${C.orange};text-decoration:none;">Terms</a>
        &nbsp;|&nbsp;
        <a href="${WEBSITE}/privacy" style="color:${C.orange};text-decoration:none;">Privacy</a>
      </p>
      ${socialIcons()}
      <p style="margin:16px 0 0 0;font-size:11px;color:#aaa;">
        © ${new Date().getFullYear()} Keboka. All rights reserved.
      </p>
    </td>
  </tr>
`;

/**
 * Master layout — every Keboka email uses this.
 */
const layout = ({ title, preheader = "", bodyHtml }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.lightBg};font-family:Arial,Helvetica,sans-serif;color:${C.text};">
  <!-- Preheader (inbox preview text) -->
  <div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.lightBg};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">

          <!-- Header: Logo -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px 20px 32px;text-align:center;border-bottom:1px solid #f0f0f0;">
              <a href="${WEBSITE}" target="_blank">
                <img src="${WEBSITE}/email/keboka-logo.png" alt="KEBOKA"
                     width="160" style="display:block;margin:0 auto;" />
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:${C.text};">
              ${bodyHtml}
            </td>
          </tr>

          ${footer()}
        </table>

        <p style="font-size:11px;color:#aaa;margin-top:16px;">
          You're receiving this email because you have a Keboka account.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─────────────────────────────────────────────
// GENERIC SENDER
// ─────────────────────────────────────────────
export const sendEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments,
    });
    console.log(`✅ [${subject}] → ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`🔴 [${subject}] → ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// 1. WELCOME / REGISTER
// ─────────────────────────────────────────────
export const sendWelcomeEmail = async (to, name, phone) => {
  const html = layout({
    title: "Welcome to Keboka",
    preheader: "Your Keboka account is ready — start winning today!",
    bodyHtml: `
      <!-- Hero image -->
      <img src="${WEBSITE}/email/hero-welcome.jpg" alt="Win big with Keboka"
           style="width:100%;border-radius:8px;display:block;margin-bottom:24px;" />

      <p style="font-size:15px;">Hi <strong>${name}</strong>,</p>
      <p>Thanks for registering with Keboka — with multiple competitions every week,
         you could be the next big winner! Log in with the details below to view your
         entries, competition history, and much more.</p>

      <!-- Credentials box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${C.lightBg};border-radius:6px;margin:20px 0;">
        <tr>
          <td style="padding:16px;text-align:center;font-size:14px;">
            Username: <strong>${phone}</strong>
          </td>
        </tr>
      </table>

      <p style="text-align:center;font-size:13px;margin:12px 0;">
        <a href="${WEBSITE}/forgot-password" style="color:${C.orange};text-decoration:none;">
          Forgot your password?
        </a>
      </p>

      ${ctaButton(`${WEBSITE}/auth`, "PLAY TODAY »")}

      ${featureIcons()}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${C.lightBg};border-radius:6px;margin-top:16px;">
        <tr>
          <td style="padding:18px;font-size:13px;color:${C.muted};text-align:center;">
            <p style="margin:0 0 8px 0;">
              All our competition winners are surprised by the Keboka team, with results
              announced via email, on the Keboka website, and on our social channels.
            </p>
            <p style="margin:0;">
              Check out our <a href="${WEBSITE}/faq" style="color:${C.orange};">FAQ page</a>
              and please be sure to update your
              <strong style="color:${C.orange};">Surprise Contact Details</strong>,
              so we know where to find you when you win!
            </p>
          </td>
        </tr>
      </table>

      ${ctaButton(`${WEBSITE}`, "KEBOKA.COM »")}

      ${promoBanner()}
    `,
  });

  return sendEmail({ to, subject: "Welcome to Keboka! 🎉", html });
};

// ─────────────────────────────────────────────
// 2. LOGIN NOTIFICATION
// ─────────────────────────────────────────────
export const sendLoginNotification = async (to, name, { ip, userAgent, time } = {}) => {
  const html = layout({
    title: "New login",
    preheader: "A new sign-in to your Keboka account",
    bodyHtml: `
      <h2 style="color:${C.navy};margin-top:0;">New sign-in to your account</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>We noticed a new login to your Keboka account:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${C.lightBg};border-radius:6px;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 16px;"><strong>Time:</strong></td><td style="padding:8px 16px;">${time || new Date().toLocaleString()}</td></tr>
        ${ip ? `<tr><td style="padding:8px 16px;"><strong>IP:</strong></td><td style="padding:8px 16px;">${ip}</td></tr>` : ""}
        ${userAgent ? `<tr><td style="padding:8px 16px;"><strong>Device:</strong></td><td style="padding:8px 16px;">${userAgent}</td></tr>` : ""}
      </table>
      <p>If this was you, no action is needed.</p>
      <p style="color:#c0392b;"><strong>If this wasn't you</strong>, reset your password immediately and contact support.</p>
      ${ctaButton(`${WEBSITE}/auth`, "RESET PASSWORD »")}
    `,
  });

  return sendEmail({ to, subject: "New login to your Keboka account", html });
};

// ─────────────────────────────────────────────
// 3. FORGOT PASSWORD
// ─────────────────────────────────────────────
export const sendForgotPasswordEmailTemplate = async (to, name, resetUrl) => {
  const html = layout({
    title: "Reset your password",
    preheader: "Click the link to reset your Keboka password",
    bodyHtml: `
      <p style="font-size:15px;">Hi <strong>${name}</strong>,</p>
      <p style="text-align:center;">
        Please click on the button below to reset your password.
      </p>
      ${ctaButton(resetUrl, "RESET PASSWORD »")}
      <p style="text-align:center;font-size:13px;color:${C.muted};">
        This link expires in <strong>1 hour</strong>. If you didn't request this,
        you can safely ignore this email.
      </p>
      ${promoBanner()}
    `,
  });

  return sendEmail({ to, subject: "Reset your Keboka password", html });
};

// ─────────────────────────────────────────────
// 4. ORDER INVOICE (matches BOTB "Thanks for playing")
// ─────────────────────────────────────────────
export const sendOrderInvoice = async (to, name, order) => {
  const { reference, amount, items = [], createdAt, status = "paid" } = order;

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;">
          ${i.title || i.type || "Ticket"}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center;">
          ${i.quantity}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;">
          ₦${Number(i.price).toLocaleString()}
        </td>
      </tr>`
    )
    .join("");

  const html = layout({
    title: "Thanks for playing",
    preheader: `Your Keboka order ${reference} is confirmed`,
    bodyHtml: `
      <h1 style="text-align:center;color:${C.navy};font-size:22px;letter-spacing:1px;margin:0 0 8px 0;">
        THANKS FOR PLAYING!
      </h1>
      <p style="text-align:center;color:${C.muted};margin-bottom:24px;">
        Hi ${name}, thanks for playing with Keboka — you could be the next big winner!
      </p>

      ${promoBanner()}

      <p style="font-size:13px;color:${C.muted};margin-top:24px;">
        Order Number: <strong>${reference}</strong>
      </p>

      ${items.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:${C.muted};padding-bottom:6px;">Item</th>
            <th style="text-align:center;font-size:12px;color:${C.muted};padding-bottom:6px;">Qty</th>
            <th style="text-align:right;font-size:12px;color:${C.muted};padding-bottom:6px;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ` : ""}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          <td style="text-align:right;font-size:14px;padding:4px 0;">Total Tickets:</td>
          <td style="text-align:right;font-size:14px;padding:4px 0;width:100px;">
            ${items.reduce((s, i) => s + Number(i.quantity || 0), 0)}
          </td>
        </tr>
        <tr>
          <td style="text-align:right;font-size:14px;padding:4px 0;">Subtotal:</td>
          <td style="text-align:right;font-size:14px;padding:4px 0;">₦${Number(amount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="text-align:right;font-size:15px;font-weight:bold;padding:8px 0;color:${C.orange};">
            Total:
          </td>
          <td style="text-align:right;font-size:15px;font-weight:bold;padding:8px 0;color:${C.orange};">
            ₦${Number(amount).toLocaleString()}
          </td>
        </tr>
      </table>

      ${ctaButton(`${WEBSITE}/competitions`, "WIN YOUR DREAM PRIZE »")}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${C.lightBg};border-radius:6px;margin-top:20px;">
        <tr>
          <td style="padding:16px;font-size:12px;color:${C.muted};text-align:center;">
            Competition draw or judging will take place once the competition ends, and
            results will be published by email and at
            <a href="${WEBSITE}" style="color:${C.orange};">keboka.com</a> within
            two days of closing. The winner will be surprised with the good news in
            person or on the phone.
          </td>
        </tr>
      </table>

      <p style="font-size:12px;color:${C.muted};text-align:center;margin-top:16px;">
        Your order is subject to <a href="${WEBSITE}/terms" style="color:${C.orange};">terms and conditions</a>.
        If you have any further questions you can visit our
        <a href="${WEBSITE}/faq" style="color:${C.orange};">FAQ page</a> or email
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.orange};">${SUPPORT_EMAIL}</a>.
      </p>
    `,
  });

  return sendEmail({
    to,
    subject: `Good luck, ${name}! Your Order #${reference} is here`,
    html,
  });
};

// ─────────────────────────────────────────────
// 5. PAYMENT RECEIPT
// ─────────────────────────────────────────────
export const sendPaymentReceipt = async (to, name, payment) => {
  const { reference, amount, method, paidAt, transactionId } = payment;

  const html = layout({
    title: "Payment receipt",
    preheader: `Payment received — receipt for ${reference}`,
    bodyHtml: `
      <h2 style="text-align:center;color:${C.orange};margin-top:0;">
        ✅ PAYMENT SUCCESSFUL
      </h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your payment has been received and confirmed. Here's your receipt:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${C.lightBg};border-radius:6px;margin:20px 0;font-size:14px;">
        <tr><td style="padding:8px 16px;"><strong>Reference:</strong></td><td style="padding:8px 16px;">${reference}</td></tr>
        ${transactionId ? `<tr><td style="padding:8px 16px;"><strong>Transaction ID:</strong></td><td style="padding:8px 16px;">${transactionId}</td></tr>` : ""}
        <tr><td style="padding:8px 16px;"><strong>Method:</strong></td><td style="padding:8px 16px;">${method || "GBiPayments"}</td></tr>
        <tr><td style="padding:8px 16px;"><strong>Date:</strong></td><td style="padding:8px 16px;">${paidAt || new Date().toLocaleString()}</td></tr>
        <tr><td style="padding:8px 16px;"><strong>Amount:</strong></td>
            <td style="padding:8px 16px;color:${C.orange};font-weight:bold;">₦${Number(amount).toLocaleString()}</td></tr>
      </table>

      <p style="font-size:13px;color:${C.muted};">
        Keep this email as your receipt.
      </p>
      ${ctaButton(`${WEBSITE}/account`, "VIEW MY ACCOUNT »")}
    `,
  });

  return sendEmail({ to, subject: `Payment Receipt — ${reference}`, html });
};

// ─────────────────────────────────────────────
// 6. TICKETS LIST
// ─────────────────────────────────────────────
export const sendTicketsEmail = async (to, name, tickets, orderRef) => {
  const rows = tickets
    .map(
      (t) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;">
          <strong>${t.ticketNumber}</strong>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;color:${C.muted};">
          ${t.competitionTitle || t.ticket_id}
        </td>
      </tr>`
    )
    .join("");

  const html = layout({
    title: "Your tickets",
    preheader: `${tickets.length} ticket(s) confirmed for order ${orderRef}`,
    bodyHtml: `
      <h2 style="text-align:center;color:${C.navy};margin-top:0;">
        🎟️ YOUR KEBOKA TICKETS
      </h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your tickets for order <strong>${orderRef}</strong> are confirmed:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:${C.muted};padding-bottom:6px;">Ticket #</th>
            <th style="text-align:right;font-size:12px;color:${C.muted};padding-bottom:6px;">Competition</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${ctaButton(`${WEBSITE}/account`, "VIEW MY TICKETS »")}

      <p style="text-align:center;font-size:13px;color:${C.muted};">
        Good luck! Keep this email for your records.
      </p>
    `,
  });

  return sendEmail({
    to,
    subject: `Your ${tickets.length} Keboka Ticket(s) — ${orderRef}`,
    html,
  });
};

// ─────────────────────────────────────────────
// 7. DRAW / WINNER NOTIFICATION
// ─────────────────────────────────────────────
export const sendDrawNotification = async (to, name, competition) => {
  const { title, drawDate, prizeName, winnerName, isWinner = false, resultsUrl } = competition;

  const html = isWinner
    ? layout({
        title: "You won!",
        preheader: `🎉 Congratulations — you won ${title}!`,
        bodyHtml: `
          <h1 style="text-align:center;color:${C.orange};font-size:24px;margin-top:0;">
            🎉 CONGRATULATIONS!
          </h1>
          <p style="text-align:center;font-size:16px;">Hi <strong>${name}</strong>,</p>
          <p style="text-align:center;">
            You've been selected as the winner of <strong>${title}</strong>!
          </p>
          <img src="${WEBSITE}/email/hero-winner.jpg" alt="Winner"
               style="width:100%;border-radius:8px;display:block;margin:20px 0;" />
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:${C.lightBg};border-radius:6px;font-size:14px;">
            <tr><td style="padding:8px 16px;"><strong>Prize:</strong></td><td style="padding:8px 16px;">${prizeName}</td></tr>
            <tr><td style="padding:8px 16px;"><strong>Draw Date:</strong></td><td style="padding:8px 16px;">${drawDate}</td></tr>
          </table>
          <p style="margin-top:20px;">
            The Promoter will contact you shortly using the phone number and email on
            your account. You have <strong>5 calendar days</strong> to respond and
            accept your prize.
          </p>
          ${ctaButton(resultsUrl || `${WEBSITE}/winners`, "SEE FULL RESULTS »")}
        `,
      })
    : layout({
        title: "Results are in",
        preheader: `Check out who won ${title}`,
        bodyHtml: `
          <img src="${WEBSITE}/email/hero-results.jpg" alt="Results"
               style="width:100%;border-radius:8px;display:block;margin-bottom:20px;" />
          <h1 style="text-align:center;color:${C.navy};font-size:22px;margin:0 0 8px 0;">
            RESULTS ARE IN!
          </h1>
          <p style="text-align:center;color:${C.orange};font-weight:bold;font-size:14px;">
            CHECK TO SEE WHO WON
          </p>
          <p style="text-align:center;">Hi <strong>${name}</strong>,</p>
          <p style="text-align:center;">
            Thanks for joining the fun at Keboka! The suspense ends now…
            Find out who's bagged the <strong>${prizeName}</strong>!
          </p>
          ${ctaButton(resultsUrl || `${WEBSITE}/winners`, "SEE RESULTS »")}
          <p style="text-align:center;font-size:13px;color:${C.muted};margin-top:20px;">
            Winner: <strong>${winnerName || "See live draw"}</strong><br/>
            Draw Date: ${drawDate}
          </p>
        `,
      });

  return sendEmail({
    to,
    subject: isWinner ? `🎉 You won ${title}!` : `🏆 ${title} — Results Are In!`,
    html,
  });
};