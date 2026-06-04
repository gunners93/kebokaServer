import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

// We use createPool instead of createConnection for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 8889,
  waitForConnections: true,
  connectionLimit: 10, // Allows up to 10 concurrent database operations
  queueLimit: 0,
  socketPath: "/Applications/MAMP/tmp/mysql/mysql.sock",
});

// Export the promise-based version so you can use 'await'
const db = pool.promise();

// Test the pool connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL Connection Error:', err.message);
  } else {
    console.log('✅ MySQL Pool Connected (MAMP)...');
    connection.release(); // Important: release the test connection back to the pool
  }
});

export default db;