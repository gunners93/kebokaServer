import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import path from "path";
dotenv.config();
const app = express();

app.use(cors({
    origin: 'https://keboka.com', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
}));
app.use(express.json());
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- CRITICAL FIXES BELOW ---
// 1. Map /api/auth to the dedicated Auth router
app.use('/api/auth', authRoutes); 

// 2. Map /api/v1 (containing competitions, types, etc.) to the Web router
app.use('/api/v1', webRoutes); 

// Removed the redundant/confusing app.use('/api/web', webRoutes); entry
// --- CRITICAL FIXES ABOVE ---

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
