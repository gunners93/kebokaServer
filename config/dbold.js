import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 8889,       // 👈 use your MAMP/WAMP MySQL port here
  // port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  socketPath: "/Applications/MAMP/tmp/mysql/mysql.sock", // ✅ adjust if needed
});

db.connect((err) => {
  if (err) throw err;
  console.log('✅ MySQL Connected...');
});

export default db;
