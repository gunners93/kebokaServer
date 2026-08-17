// services/gbipayments.service.js
import axios from 'axios';
import http from 'http';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

class GBiPaymentsService {
  constructor() {
    this.publicKey = process.env.DUSUPAY_API_KEY;
    this.secretKey = process.env.DUSUPAY_SECRET;
    this.environment = process.env.DUSUPAY_ENV || 'sandbox';
    this.apiVersion = process.env.DUSUPAY_API_VERSION || '1';
    
    this.baseURL = this.environment === 'production' 
      ? 'https://payments.gbipayments.com' 
      : 'https://gwapisdbx.gbipayments.com';
    
    this.webhookURL = process.env.DUSUPAY_WEBHOOK_URL || 'https://collector-smokiness-underwent.ngrok-free.dev/api/pay/webhook';

    // Merchant bank details from environment variables
    this.merchantBank = {
      bank_name: process.env.GBIPAYMENTS_MERCHANT_BANK_NAME || null,
      account_name: process.env.GBIPAYMENTS_MERCHANT_ACCOUNT_NAME || null,
      account_number: process.env.GBIPAYMENTS_MERCHANT_ACCOUNT_NUMBER || null,
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': this.apiVersion,
        'public-key': this.publicKey,
      },
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNRESET') {
          console.error('❌ Connection reset - Retrying...');
        } else if (error.response) {
          console.error(`❌ GBiPayments API Error (${error.response.status}):`, 
            JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
          console.error('❌ No response from GBiPayments:', error.message);
        } else {
          console.error('❌ GBiPayments Error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    console.log('🔗 GBiPayments Service Initialized:');
    console.log(`  - Environment: ${this.environment}`);
    console.log(`  - Base URL: ${this.baseURL}`);
    console.log(`  - API Version: ${this.apiVersion}`);
    console.log(`  - Public Key: ${this.publicKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Merchant Bank: ${this.merchantBank.bank_name ? '✅ Set' : '❌ Missing'}`);
  }

  /**
   * Make API request with retry logic
   */
  async makeRequest(method, endpoint, data = null, retries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📤 Attempt ${attempt}/${retries}: ${method} ${endpoint}`);
        
        let response;
        if (method === 'GET') {
          response = await this.client.get(endpoint);
        } else if (method === 'POST') {
          response = await this.client.post(endpoint, data);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        if (error.code === 'ECONNRESET' || error.message === 'read ECONNRESET') {
          console.log(`⚠️ Connection reset. Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        if (error.response && (error.response.status >= 400 && error.response.status < 600)) {
          throw error;
        }
        
        if (attempt < retries) {
          console.log(`⚠️ Request failed. Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get available payment providers
   */
  async getPaymentProviders() {
    try {
      const response = await this.makeRequest('GET', '/data/payment-providers', null, 2);
      return {
        success: true,
        data: response.data,
        providers: response.data.data?.payment_providers || [],
      };
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to get payment providers',
        error: error.message,
      };
    }
  }

  /**
   * Initialize a BANK payment collection
   * POST /collections/initialize
   */
  async initializePayment({
    amount,
    currency = 'NGN',
    merchantReference,
    description,
    callbackUrl,
    customerName,
    customerEmail,
    chargeCustomer = false,
    metadata = {}
  }) {
    try {
      const payload = {
        merchant_reference: merchantReference || 'auto',
        transaction_method: 'BANK',
        currency: currency,
        amount: amount,
        provider_code: 'bank_ng',
        customer_name: customerName || 'Customer',
        description: description?.substring(0, 30) || 'KBK Payment',
        charge_customer: chargeCustomer,
      };

      if (customerEmail) payload.customer_email = customerEmail;
      if (Object.keys(metadata).length > 0) payload.metadata = metadata;

      console.log('📤 Payment Request Payload:', JSON.stringify(payload, null, 2));

      const response = await this.makeRequest('POST', '/collections/initialize', payload, 3);
      
      if (response.data?.code === 202 || response.data?.status === 'accepted') {
        const internalReference = response.data.data?.internal_reference;
        const merchantRef = response.data.data?.merchant_reference || merchantReference;
        
        console.log(`✅ Payment accepted. Internal Reference: ${internalReference}`);
        
        // Now get the transaction details for bank transfer information
        console.log('📤 Fetching transaction details...');
        const transactionDetails = await this.getTransactionDetails(internalReference);
        
        return {
          success: true,
          data: response.data,
          internal_reference: internalReference,
          reference: merchantRef,
          status: 'pending',
          transaction_details: transactionDetails,
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Payment initiation failed',
        error: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Payment initiation failed',
        error: error.message,
      };
    }
  }

  /**
   * Get transaction details - Uses merchant bank details from .env
   * GET /data/transaction/{internal_reference}
   */
  async getTransactionDetails(internalReference) {
    try {
      const response = await this.makeRequest('GET', `/data/transaction/${internalReference}`, null, 2);
      
      console.log('📤 Transaction Details Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data?.code === 200 || response.data?.status === 'success') {
        const transaction = response.data.data || {};
        
        // Build bank details from merchant bank details + transaction data
        const bankDetails = {
          // Merchant bank details (from .env)
          bank_name: this.merchantBank.bank_name,
          account_name: this.merchantBank.account_name,
          account_number: this.merchantBank.account_number,
          // Transaction specific details
          reference: transaction.transaction_account || transaction.internal_reference,
          amount: transaction.transaction_amount || transaction.amount,
          currency: transaction.transaction_currency || 'NGN',
          customer_name: transaction.customer_name,
          transaction_status: transaction.transaction_status,
          status_message: transaction.status_message,
          merchant_reference: transaction.merchant_reference,
          internal_reference: transaction.internal_reference,
          charge: transaction.transaction_charge,
          total_credit: transaction.total_credit,
        };
        
        return {
          success: true,
          data: response.data,
          bank_details: bankDetails,
          transaction: transaction,
          merchant_bank_configured: !!this.merchantBank.account_number,
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Failed to get transaction details',
        error: response.data,
      };
    } catch (error) {
      if (error.response) {
        console.error('❌ API Error Response:', JSON.stringify(error.response.data, null, 2));
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to get transaction details',
        error: error.message,
      };
    }
  }

  /**
   * Confirm a payment
   * POST /collections/confirm
   */
  async confirmPayment(merchantReference) {
    try {
      const response = await this.makeRequest('POST', '/collections/confirm', {
        merchant_reference: merchantReference,
      }, 2);
      
      return {
        success: true,
        data: response.data,
        status: response.data.status,
      };
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to confirm payment',
        error: error.message,
      };
    }
  }

  /**
   * Verify a payment
   * GET /data/transaction/verify/{merchant_reference}
   */
  async verifyPayment(merchantReference) {
    try {
      const response = await this.makeRequest('GET', `/data/transaction/verify/${merchantReference}`, null, 2);
      
      if (response.data?.code === 200 || response.data?.status === 'success') {
        const data = response.data.data || {};
        
        return {
          success: true,
          data: response.data,
          status: data.transaction_status || response.data.status,
          amount: data.transaction_amount,
          currency: data.transaction_currency,
          reference: data.merchant_reference,
          transaction_id: data.internal_reference,
          bank_details: {
            bank_name: this.merchantBank.bank_name,
            account_name: this.merchantBank.account_name,
            account_number: this.merchantBank.account_number,
          },
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Payment verification failed',
        error: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Payment verification failed',
        error: error.message,
      };
    }
  }

  /**
   * Abort a payment
   * POST /collections/abort
   */
  async abortPayment(merchantReference) {
    try {
      const response = await this.makeRequest('POST', '/collections/abort', {
        merchant_reference: merchantReference,
      }, 2);
      
      return {
        success: true,
        data: response.data,
        status: response.data.status,
      };
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || error.message,
          error: error.response.data,
          statusCode: error.response.status,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to abort payment',
        error: error.message,
      };
    }
  }

  /**
   * Get merchant bank details
   */
  getMerchantBankDetails() {
    return this.merchantBank;
  }
}

export default new GBiPaymentsService();