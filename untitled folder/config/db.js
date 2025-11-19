import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,       // your VPS IP or domain
  user: process.env.DB_USER,       // keboka_admin
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Export the pool as a promise
const db = pool.promise();

db.getConnection()
  .then(() => console.log("✅ MySQL Connected (Pool)"))
  .catch((err) => console.error("❌ MySQL Connection Error:", err));

export default db;
