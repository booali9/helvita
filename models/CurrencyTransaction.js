const mongoose = require('mongoose');

const currencyTransactionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  currencyAccount: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CurrencyAccount', 
    required: true 
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'exchange', 'fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'NZD', 'HKD'],
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  metadata: {
    fromCurrency: String,
    toCurrency: String,
    exchangeRate: Number,
    originalAmount: Number,
    externalTransactionId: String,
    paymentMethod: String
  }
}, { 
  timestamps: true,
  indexes: [
    { user: 1, createdAt: -1 },
    { currencyAccount: 1, createdAt: -1 },
    { transactionId: 1, unique: true }
  ]
});

// Generate unique transaction ID
currencyTransactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transactionId = `TXN-${this.currency}-${timestamp}-${random}`;
  }
  next();
});

// Method to format transaction amount
currencyTransactionSchema.methods.getFormattedAmount = function() {
  const currencyFormats = {
    USD: { symbol: '$', decimals: 2 },
    CAD: { symbol: 'C$', decimals: 2 },
    EUR: { symbol: '€', decimals: 2 },
    GBP: { symbol: '£', decimals: 2 },
    JPY: { symbol: '¥', decimals: 0 },
    AUD: { symbol: 'A$', decimals: 2 },
    CHF: { symbol: 'CHF', decimals: 2 },
    CNY: { symbol: '¥', decimals: 2 },
    NZD: { symbol: 'NZ$', decimals: 2 },
    HKD: { symbol: 'HK$', decimals: 2 }
  };

  const format = currencyFormats[this.currency];
  const sign = ['withdrawal', 'transfer_out', 'fee'].includes(this.type) ? '-' : '+';
  
  return {
    amount: this.amount.toFixed(format.decimals),
    symbol: format.symbol,
    currency: this.currency,
    formatted: `${sign}${format.symbol}${this.amount.toFixed(format.decimals)}`
  };
};

module.exports = mongoose.model('CurrencyTransaction', currencyTransactionSchema);