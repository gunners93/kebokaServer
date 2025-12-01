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
app.use('/api/auth', authRoutes);

app.use('/api/v1', authRoutes);
app.use('/api/web', webRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
