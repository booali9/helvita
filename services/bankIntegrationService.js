const plaidService = require('./plaidService');
const stripeService = require('./stripeService');
const CurrencyService = require('./currencyService');
const ExchangeRateService = require('./exchangeRateService');
const User = require('../models/User');

class BankIntegrationService {
  
  /**
   * Fund a currency account from user's Plaid bank account
   */
  async fundFromBank(userId, currencyAccountId, amount, description = 'Bank transfer') {
    try {
      // Get user's Plaid access token
      const user = await User.findById(userId);
      if (!user || !user.plaidAccessToken) {
        throw new Error('Bank account not connected');
      }

      // Get user's bank accounts
      const accounts = await plaidService.getAccounts(user.plaidAccessToken);
      if (!accounts || accounts.length === 0) {
        throw new Error('No bank accounts found');
      }

      // Use the first available account (you can modify this logic)
      const bankAccount = accounts[0];
      
      // For demo purposes, we'll simulate the bank transfer
      // In production, you'd use Plaid's transfer API or ACH
      console.log(`Simulating bank transfer: $${amount} from ${bankAccount.name}`);
      
      // Process the deposit to currency account
      const result = await CurrencyService.processTransaction(
        userId,
        currencyAccountId,
        'deposit',
        amount,
        `${description} - From ${bankAccount.name}`,
        {
          source: 'bank',
          bankAccountId: bankAccount.account_id,
          bankName: bankAccount.name
        }
      );

      return {
        success: true,
        transaction: result.transaction,
        bankAccount: {
          name: bankAccount.name,
          mask: bankAccount.mask
        }
      };

    } catch (error) {
      console.error('Error funding from bank:', error);
      throw error;
    }
  }

  /**
   * Withdraw from currency account to bank
   */
  async withdrawToBank(userId, currencyAccountId, amount, description = 'Bank withdrawal') {
    try {
      // Get user's Plaid access token
      const user = await User.findById(userId);
      if (!user || !user.plaidAccessToken) {
        throw new Error('Bank account not connected');
      }

      // Process the withdrawal from currency account
      const result = await CurrencyService.processTransaction(
        userId,
        currencyAccountId,
        'withdrawal',
        amount,
        `${description} - To bank account`,
        {
          destination: 'bank'
        }
      );

      // In production, initiate actual bank transfer here
      console.log(`Simulating bank withdrawal: $${amount} to user's bank account`);

      return {
        success: true,
        transaction: result.transaction
      };

    } catch (error) {
      console.error('Error withdrawing to bank:', error);
      throw error;
    }
  }

  /**
   * Exchange currency between accounts
   */
  async exchangeCurrency(userId, fromAccountId, toAccountId, amount) {
    try {
      // Get both currency accounts
      const fromAccount = await CurrencyService.getAccountBalance(userId, fromAccountId);
      const toAccount = await CurrencyService.getAccountBalance(userId, toAccountId);

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Get exchange rate
      const conversion = await ExchangeRateService.convertAmount(
        amount, 
        fromAccount.currency, 
        toAccount.currency
      );

      // Calculate fee (0.5% of original amount)
      const fee = ExchangeRateService.calculateFee(amount);
      const netAmount = amount - fee;
      const convertedAmount = netAmount * conversion.exchangeRate;

      // Process withdrawal from source account
      await CurrencyService.processTransaction(
        userId,
        fromAccountId,
        'exchange',
        amount,
        `Exchange to ${toAccount.currency}`,
        {
          toCurrency: toAccount.currency,
          exchangeRate: conversion.exchangeRate,
          convertedAmount: convertedAmount,
          fee: fee
        }
      );

      // Process deposit to destination account
      await CurrencyService.processTransaction(
        userId,
        toAccountId,
        'exchange',
        convertedAmount,
        `Exchange from ${fromAccount.currency}`,
        {
          fromCurrency: fromAccount.currency,
          exchangeRate: conversion.exchangeRate,
          originalAmount: amount,
          fee: fee
        }
      );

      return {
        success: true,
        exchange: {
          fromCurrency: fromAccount.currency,
          toCurrency: toAccount.currency,
          originalAmount: amount,
          convertedAmount: convertedAmount,
          exchangeRate: conversion.exchangeRate,
          fee: fee
        }
      };

    } catch (error) {
      console.error('Error exchanging currency:', error);
      throw error;
    }
  }

  /**
   * Get user's bank account info
   */
  async getBankAccountInfo(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.plaidAccessToken) {
        return { connected: false };
      }

      const accounts = await plaidService.getAccounts(user.plaidAccessToken);
      return {
        connected: true,
        accounts: accounts.map(acc => ({
          id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        }))
      };

    } catch (error) {
      console.error('Error getting bank account info:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Create Stripe payment intent for funding
   */
  async createStripePaymentIntent(userId, currencyAccountId, amount, currency = 'usd') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create payment intent with Stripe
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        customer: user.stripeCustomerId,
        metadata: {
          userId: userId,
          currencyAccountId: currencyAccountId,
          type: 'currency_funding'
        }
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };

    } catch (error) {
      console.error('Error creating Stripe payment intent:', error);
      throw error;
    }
  }
}

module.exports = new BankIntegrationService();