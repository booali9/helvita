const axios = require('axios');

class ExchangeRateService {
  constructor() {
    // Using a free exchange rate API - you can replace with a premium service
    this.baseURL = 'https://api.exchangerate-api.com/v4/latest';
    this.fallbackRates = {
      USD: { CAD: 1.35, EUR: 0.85, GBP: 0.73, JPY: 110, AUD: 1.45, CHF: 0.92, CNY: 6.45, NZD: 1.55, HKD: 7.8 },
      EUR: { USD: 1.18, CAD: 1.59, GBP: 0.86, JPY: 129, AUD: 1.71, CHF: 1.08, CNY: 7.6, NZD: 1.83, HKD: 9.2 },
      GBP: { USD: 1.37, CAD: 1.85, EUR: 1.16, JPY: 150, AUD: 1.99, CHF: 1.26, CNY: 8.84, NZD: 2.13, HKD: 10.7 }
    };
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    try {
      // Try to get live rates
      const response = await axios.get(`${this.baseURL}/${fromCurrency}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.rates && response.data.rates[toCurrency]) {
        return response.data.rates[toCurrency];
      }
    } catch (error) {
      console.warn('Failed to fetch live exchange rates, using fallback:', error.message);
    }

    // Fallback to static rates
    return this.getFallbackRate(fromCurrency, toCurrency);
  }

  getFallbackRate(fromCurrency, toCurrency) {
    if (this.fallbackRates[fromCurrency] && this.fallbackRates[fromCurrency][toCurrency]) {
      return this.fallbackRates[fromCurrency][toCurrency];
    }
    
    // Try reverse rate
    if (this.fallbackRates[toCurrency] && this.fallbackRates[toCurrency][fromCurrency]) {
      return 1 / this.fallbackRates[toCurrency][fromCurrency];
    }
    
    // Default fallback
    return 1;
  }

  async convertAmount(amount, fromCurrency, toCurrency) {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return {
      originalAmount: amount,
      convertedAmount: amount * rate,
      exchangeRate: rate,
      fromCurrency,
      toCurrency
    };
  }

  calculateFee(amount, feePercentage = 0.5) {
    return amount * (feePercentage / 100);
  }
}

module.exports = new ExchangeRateService();