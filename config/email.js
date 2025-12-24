import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: 'mail.keboka.com', // e.g., smtp.gmail.com
  port: 587, // or 465 for secure
  secure: false, // true for port 465
  auth: {
    user: 'admin@keboka.com', // your email
    pass: 'Fatima93**', // your email password or app password
  },
});

// Test transporter
transporter.verify((error, success) => {
  if (error) console.log('Email config error:', error);
  else console.log('Email is ready to send');
});
