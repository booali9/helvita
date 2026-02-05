const mongoose = require('mongoose');

const currencyAccountSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  currency: {
    type: String,
    enum: ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'NZD', 'HKD'],
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastTransactionDate: {
    type: Date
  }
}, { 
  timestamps: true,
  // Ensure one account per user per currency
  indexes: [
    { user: 1, currency: 1, unique: true }
  ]
});

// Generate unique account number
currencyAccountSchema.pre('save', function(next) {
  if (!this.accountNumber) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const currency = this.currency || 'CUR';
    this.accountNumber = `${currency}-${timestamp}-${random}`;
  }
  next();
});

// Static method to get supported currencies
currencyAccountSchema.statics.getSupportedCurrencies = function() {
  return ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'NZD', 'HKD'];
};

// Method to format balance according to currency
currencyAccountSchema.methods.getFormattedBalance = function() {
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
  return {
    amount: this.balance.toFixed(format.decimals),
    symbol: format.symbol,
    currency: this.currency,
    formatted: `${format.symbol}${this.balance.toFixed(format.decimals)}`
  };
};

module.exports = mongoose.model('CurrencyAccount', currencyAccountSchema);