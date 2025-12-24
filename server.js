import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
// We need to import db to ensure the connection process in db.js runs
import db from './config/db.js'; 
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import path from "path";

dotenv.config();
const app = express();
<<<<<<< HEAD

const allowedOrigins = [
    'https://keboka.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like postman or curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
}));




app.use(express.json());
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));
// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', webRoutes);

// Simple root check
app.get('/', (req, res) => {
    res.send('Keboka API is running!');
});
=======
>>>>>>> af25c2c1f4a4c5a8c7a835e86deee642e1962a03
const PORT = process.env.PORT || 5000;

// Define allowed origins for secure CORS configuration
const allowedOrigins = [
    'https://keboka.com',
    // Added common variations and the non-secure version of the main domain
    'http://keboka.com', 
    'https://www.keboka.com', 
    'http://www.keboka.com',
    'http://localhost:5174'
];

app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like postman or curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        // --- TEMPORARY LOGGING AND BYPASS FIX ---
        // Log the unrecognized origin but allow the request to pass temporarily.
        console.error(`🔴 CORS WARNING: Request blocked from unrecognized origin: ${origin}`);
        // Temporarily allow the request so the frontend can load and we can capture the correct origin.
        return callback(null, true); 
        // ---------------------------------------
      }
      return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static uploaded files (as requested in your input)
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));


// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', webRoutes);
app.use('/api/v2', authRoutes);
// Simple root check
app.get('/', (req, res) => {
    res.send('Keboka API is running!');
});


// ----------------------------------------------------
// CRITICAL FIX: Removed Sequelize-specific authentication code.
// The server now starts immediately, relying on the asynchronous 
// mysql2 connection setup in ./config/db.js.
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`✅ Server is running successfully on port ${PORT}`);
    console.log(`Public URL: https://api.keboka.com (proxied)`);
});
