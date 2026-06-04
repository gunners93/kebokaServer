import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import path from "path";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Define allowed origins for secure CORS configuration
const allowedOrigins = [
    'https://keboka.com',
    'http://keboka.com', 
    'https://www.keboka.com', 
    'http://www.keboka.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function (origin, callback) {

      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
      
        console.error(`🔴 CORS WARNING: Request blocked from unrecognized origin: ${origin}`);
       
        return callback(null, true); 
     
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
app.use('/api/pay', paymentRoutes);
// Simple root check
app.get('/', (req, res) => {
    res.send('Keboka API is running!');
});



app.listen(PORT, () => {
    console.log(`✅ Server is running successfully on port ${PORT}`);
    console.log(`Public URL: https://api.keboka.com (proxied)`);
});
