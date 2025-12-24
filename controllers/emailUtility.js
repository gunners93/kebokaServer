import nodemailer from 'nodemailer';
import crypto from 'crypto';
import db from '../config/db.js'; // your MySQL connection
import { transporter } from '../config/email.js';
import bcrypt from "bcryptjs";
export const sendWelcomeEmail = async (to, name) => {
    const mailOptions = {
        from: `Keboka <admin@keboka.com>`, // Sender address
        to: to, // List of recipients
        subject: 'Welcome to Keboka! 🎉', // Subject line
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4CAF50;">Hello ${name},</h2>
                <p>Thank you for registering with Keboka. We're excited to have you on board!</p>
                <p>You can now log in and start exploring our platform and competitions.</p>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <p>Best Regards,</p>
                <p>The Keboka Team</p>
            </div>
        `,
        text: `Hello ${name},\n\nThank you for registering with Keboka. We're excited to have you on board! If you have any questions, feel free to reach out to our support team.\n\nBest Regards,\nThe Keboka Team`,
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent: %s", info.messageId);
        // You might want to remove this line in production for security, but helpful for debugging
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info)); 
    } catch (error) {
        console.error("🔴 Error sending welcome email to %s:", to, error);
        // In a real application, you would log this error and potentially queue a retry
    }
};


export const sendForgotPasswordEmail = async (email) => {
  try {
    // Check if user exists using email
    const query = "SELECT * FROM users WHERE email = ?";
    const [rows] = await db.promise().query(query, [email]); // use .promise()
    if (rows.length === 0) {
      throw new Error('Email not found');
    }
    const user = rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save token & expiry in DB
    await db.promise().query(
      'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE Id = ?',
      [resetToken, resetExpires, user.Id]
    );

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // Send email
    await transporter.sendMail({
      from: `"KEBOKA" <admin@keboka.com>`,
      to: email,
      subject: 'Password   Reset Request',
      html: `
        <p>Hi ${user.name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" target="_blank">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    return { message: 'Password reset link sent to your email.' };
  } catch (err) {
    console.error(err);
    throw err;
  }
};


// Reset Password
export const resetPassword = async (token, newPassword) => {
  try {
    // Use promise() to make queries awaitable
    const [rows] = await db.promise().query(
      'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()',
      [token]
    );

    if (rows.length === 0) throw new Error('Invalid or expired token');

    const user = rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password & clear token
    await db.promise().query(
      'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    return { message: 'Password successfully updated.' };
  } catch (err) {
    console.error(err);
    throw err;
  }
};