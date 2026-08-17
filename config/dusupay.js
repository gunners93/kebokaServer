// config/dusupay.js
require('dotenv').config();

module.exports = {
  // DusuPay API Keys (get these from your DusuPay dashboard)
  DUSUPAY_API_KEY: process.env.DUSUPAY_API_KEY,
  DUSUPAY_SECRET_KEY: process.env.DUSUPAY_SECRET_KEY,
  DUSUPAY_WEBHOOK_SECRET: process.env.DUSUPAY_WEBHOOK_SECRET,
  
  // Environment (sandbox or production)
  DUSUPAY_ENV: process.env.DUSUPAY_ENV || 'sandbox',
  
  // API URLs
  get BASE_URL() {
    return this.DUSUPAY_ENV === 'production' 
      ? 'https://api.dusupay.com/v1' 
      : 'https://api.sandbox.dusupay.com/v1';
  },
  
  // Redirect URLs
  SUCCESS_URL: process.env.DUSUPAY_SUCCESS_URL || 'https://yourdomain.com/checkout?status=success',
  FAILURE_URL: process.env.DUSUPAY_FAILURE_URL || 'https://yourdomain.com/checkout?status=failed',
  WEBHOOK_URL: process.env.DUSUPAY_WEBHOOK_URL || 'https://yourdomain.com/api/pay/webhook',
};