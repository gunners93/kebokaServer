// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import webRoutes from './routes/webRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
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
  'https://api.keboka.com',        // ✅ ADD THIS
  'http://api.keboka.com',          // ✅ ADD THIS
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // For production, you want to block unknown origins
    // But if you want to allow all for testing, uncomment the line below
    // return callback(null, true);
    
    console.error(`🔴 CORS WARNING: Request blocked from unrecognized origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "ngrok-skip-browser-warning",
    "x-api-version",
    "public-key"
  ],
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', webRoutes);
app.use('/api/v2', authRoutes);
app.use('/api/pay', paymentRoutes);
app.use('/api/admin', adminRoutes);
// Simple root check
app.get('/', (req, res) => {
  res.send('Keboka API is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test config endpoint
app.get('/api/pay/test-config', (req, res) => {
  res.json({
    success: true,
    message: 'DusuPay configuration loaded',
    config: {
      apiKey: process.env.DUSUPAY_API_KEY ? '✅ Set' : '❌ Missing',
      secretKey: process.env.DUSUPAY_SECRET ? '✅ Set' : '❌ Missing',
      environment: process.env.DUSUPAY_ENV || 'sandbox',
      webhookURL: process.env.DUSUPAY_WEBHOOK_URL || 'Not set',
      successURL: process.env.DUSUPAY_SUCCESS_URL || 'Not set',
      failureURL: process.env.DUSUPAY_FAILURE_URL || 'Not set',
      backendURL: process.env.BACKEND_URL || 'Not set',
      frontendURL: process.env.FRONTEND_URL || 'Not set',
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running successfully on port ${PORT}`);
  console.log(`📍 Public URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
});