import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import path from "path";
dotenv.config();
const app = express();

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
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));
// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', webRoutes);

// Simple root check
app.get('/', (req, res) => {
    res.send('Keboka API is running!');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
