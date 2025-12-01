import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import path from "path";

dotenv.config();
const app = express();

// Define allowed origins for secure CORS configuration
const allowedOrigins = [
    'https://keboka.com',
    'http://localhost:5174' // Critical for local testing
];

app.use(cors({
    // Dynamic origin check
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
    // *** Apache directives removed: This section must only contain JS properties ***
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

// Database connection and server start
db.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.log('Error: ' + err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running on port ${PORT}`));
