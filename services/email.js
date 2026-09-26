// services/email.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { sendForgotPasswordEmailTemplate } from "./email.service.js";

export const sendForgotPasswordEmail = async (email) => {
  // ✅ FIX: db.query not db.promise().query
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  if (rows.length === 0) throw new Error("Email not found");

  const user = rows[0];
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 3600000); // 1 hour

  // ✅ FIX: lowercase `id`, direct db.query
  await db.query(
    "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?",
    [resetToken, resetExpires, user.id]
  );

  const resetUrl = `https://www.keboka.com/reset-password/${resetToken}`;
  await sendForgotPasswordEmailTemplate(email, user.name, resetUrl);

  return { message: "Password reset link sent to your email." };
};

export const resetPassword = async (token, newPassword) => {
  const [rows] = await db.query(
    "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()",
    [token]
  );
  if (rows.length === 0) throw new Error("Invalid or expired token");

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db.query(
    "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
    [hashedPassword, rows[0].id]
  );

  return { message: "Password successfully updated." };
};