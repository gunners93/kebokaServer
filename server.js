import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
// Assuming db is the Sequelize instance object that has the authenticate method
import db from './config/db.js'; 
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import path from "path";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Define allowed origins for secure CORS configuration
const allowedOrigins = [
    'https://keboka.com',
    'http://localhost:5174'
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
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', webRoutes);

// Simple root check
app.get('/', (req, res) => {
    res.send('Keboka API is running!');
});


// ----------------------------------------------------
// CRITICAL FIX: Ensure the server only starts after DB authentication
// ----------------------------------------------------
async function startServer() {
    try {
        // 1. Authenticate the database connection
        // NOTE: If db.authenticate() is still failing, it means your db.js 
        // exports an object, e.g., { sequelize: dbInstance }.
        // If so, change this line to: await db.sequelize.authenticate();
        await db.authenticate(); 
        
        console.log('Database connection has been established successfully.');

        // 2. Start the Express server
        app.listen(PORT, () => {
            console.log(`✅ Server is running successfully on port ${PORT}`);
            console.log(`Public URL: https://api.keboka.com (proxied)`);
        });

    } catch (error) {
        console.error('❌ Server startup failed due to database error:', error);
        // Exiting the process will allow PM2 to attempt a restart
        process.exit(1); 
    }
}

startServer();
