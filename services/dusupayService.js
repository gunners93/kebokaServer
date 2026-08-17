// services/dusupayService.js - Try all provider code variations
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class DusuPayService {
  constructor() {
    this.publicKey = process.env.DUSUPAY_API_KEY;
    this.secretKey = process.env.DUSUPAY_SECRET;
    this.environment = process.env.DUSUPAY_ENV || 'sandbox';
    this.apiVersion = process.env.DUSUPAY_API_VERSION || '1';
    
    this.baseURL = this.environment === 'production' 
      ? 'https://payments.gbipayments.com' 
      : 'https://gwapisdbx.gbipayments.com';
    
    this.webhookURL = process.env.DUSUPAY_WEBHOOK_URL || 'https://collector-smokiness-underwent.ngrok-free.dev/api/pay/webhook';
    
    // Try ALL possible provider code formats
    this.providerCodeFormats = {
      'MTN': ['MTN', 'MTN_NG', 'MTNNG', 'mtn', 'mtn_ng', 'MTN-NG', 'MTNNG', '23401'],
      'AIRTEL': ['AIRTEL', 'AIRTEL_NG', 'AIRTELNG', 'airtel', 'airtel_ng', 'AIRTEL-NG', '23402'],
      'GLO': ['GLO', 'GLO_NG', 'GLONG', 'glo', 'glo_ng', 'GLO-NG', '23405'],
      '9MOBILE': ['9MOBILE', '9MOBILE_NG', '9MOBILENG', '9mobile', '9mobile_ng', '9MOBILE-NG', '23409'],
    };
    
    console.log('🔗 GBiPayments Service Configuration:');
    console.log(`  - Environment: ${this.environment}`);
    console.log(`  - Base URL: ${this.baseURL}`);
    console.log(`  - API Version: ${this.apiVersion}`);
    console.log(`  - Public Key: ${this.publicKey ? '✅ Set' : '❌ Missing'}`);
  }

  getAuthHeaders(includeSecret = false) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-version': this.apiVersion,
      'public-key': this.publicKey,
    };

    if (includeSecret && this.secretKey) {
      headers['secret-key'] = this.secretKey;
    }

    return headers;
  }

  // Initialize Payment - Use /collections/initialize
  async initiatePayment({
    amount,
    reference,
    description,
    transactionMethod = 'MOBILE_MONEY',
    providerCode = 'MTN',
    phone = ''
  }) {
    // Try all provider code variations
    const providerVariations = this.providerCodeFormats[providerCode.toUpperCase()] || [providerCode];
    
    // Also try without provider code
    const attempts = [
      ...providerVariations.map(code => ({ provider_code: code })),
      { provider_code: null }, // Try without provider code
    ];
    
    for (const attempt of attempts) {
      try {
        const url = `${this.baseURL}/collections/initialize`;
        
        const amountInKobo = Math.round(parseFloat(amount) * 100);
        
        let shortDescription = description || 'KBK Payment';
        if (shortDescription.length > 30) {
          shortDescription = shortDescription.substring(0, 27) + '...';
        }
        
        let msisdn = phone.replace(/\D/g, '');
        if (msisdn.startsWith('0')) {
          msisdn = '234' + msisdn.substring(1);
        } else if (!msisdn.startsWith('234')) {
          msisdn = '234' + msisdn;
        }
        
        const payload = {
          amount: amountInKobo,
          currency: 'NGN',
          merchant_reference: reference,
          description: shortDescription,
          callback_url: this.webhookURL,
          transaction_method: transactionMethod,
          msisdn: msisdn,
        };
        
        // Add provider_code if present
        if (attempt.provider_code) {
          payload.provider_code = attempt.provider_code;
        }
        
        console.log(`📤 Trying provider_code: "${attempt.provider_code || 'NONE'}"`);
        console.log('  - Payload:', JSON.stringify(payload, null, 2));
        
        const response = await axios.post(
          url,
          payload,
          {
            headers: this.getAuthHeaders(),
            timeout: 30000,
          }
        );
        
        console.log('✅ Raw API Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data && (response.data.code === 200 || response.data.status === 'success')) {
          console.log(`✅ SUCCESS with provider_code: "${attempt.provider_code || 'NONE'}"`);
          return {
            success: true,
            data: response.data,
            checkout_url: response.data.data?.checkout_url || response.data.data?.redirect_url,
            transaction_id: response.data.data?.transaction_id || response.data.data?.internal_reference,
            reference: response.data.data?.merchant_reference || reference,
            status: response.data.data?.status || 'pending',
          };
        } else {
          // If the error is not about provider_code, stop trying
          if (response.data?.message && !response.data.message.includes('provider')) {
            return {
              success: false,
              message: response.data?.message || 'Payment initiation failed',
              error: response.data,
            };
          }
          // Otherwise continue to next provider code
          console.log(`⚠️ Failed with provider_code: "${attempt.provider_code || 'NONE'}"`);
        }
      } catch (error) {
        if (error.response) {
          console.log(`⚠️ Error with provider_code: "${attempt.provider_code || 'NONE'}"`);
          console.log('  - Status:', error.response.status);
          console.log('  - Message:', error.response.data?.message);
          
          // If the error is not about provider_code, stop trying
          if (error.response.data?.message && !error.response.data.message.includes('provider')) {
            return {
              success: false,
              message: error.response.data?.message || error.message || 'Payment initiation failed',
              error: error.response.data,
            };
          }
        }
      }
    }
    
    // If all attempts failed
    return {
      success: false,
      message: 'All provider code attempts failed. Please check the valid provider codes.',
      error: 'Unknown provider code',
    };
  }

  // Get Payment Providers - To get valid provider codes
  async getPaymentProviders() {
    try {
      const response = await axios.get(
        `${this.baseURL}/data/payment-providers`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      console.log('✅ Available Providers:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        providers: response.data.data,
      };
    } catch (error) {
      console.error('❌ Get Payment Providers Error:', error.message);
      if (error.response) {
        console.error('  - Status:', error.response.status);
        console.error('  - Data:', JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        message: 'Failed to get payment providers',
        error: error.message,
      };
    }
  }

  // Verify Payment
  async verifyPayment(reference) {
    try {
      const url = `${this.baseURL}/data/transaction/verify/${reference}`;
      
      console.log('📤 Verify Payment Request:');
      console.log('  - URL:', url);

      const response = await axios.get(
        url,
        {
          headers: this.getAuthHeaders(),
        }
      );

      console.log('✅ Verify Payment Response:', JSON.stringify(response.data, null, 2));

      if (response.data && (response.data.code === 200 || response.data.status === 'success')) {
        return {
          success: true,
          data: response.data,
          status: response.data.data?.status || response.data.status,
          amount: response.data.data?.amount,
          currency: response.data.data?.currency,
          reference: response.data.data?.merchant_reference || reference,
          transaction_id: response.data.data?.transaction_id || response.data.data?.internal_reference,
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Payment verification failed',
          error: response.data,
        };
      }
    } catch (error) {
      console.error('❌ Payment Verification Error:');
      if (error.response) {
        console.error('  - Status:', error.response.status);
        console.error('  - Data:', JSON.stringify(error.response.data, null, 2));
        return {
          success: false,
          message: error.response.data?.message || 'Payment verification failed',
          error: error.response.data,
        };
      } else {
        return {
          success: false,
          message: error.message || 'Payment verification failed',
          error: error.message,
        };
      }
    }
  }
}

export default new DusuPayService();