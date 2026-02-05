const CurrencyAccount = require('../models/CurrencyAccount');
const CurrencyTransaction = require('../models/CurrencyTransaction');
const mongoose = require('mongoose');

class CurrencyService {
  /**
   * Process a transaction for a currency account
   * @param {string} userId - User ID
   * @param {string} accountId - Currency account ID
   * @param {string} type - Transaction type
   * @param {number} amount - Transaction amount
   * @param {string} description - Transaction description
   * @param {object} metadata - Additional transaction metadata
   */
  static async processTransaction(userId, accountId, type, amount, description, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get the currency account
      const account = await CurrencyAccount.findOne({
        _id: accountId,
        user: userId,
        isActive: true
      }).session(session);

      if (!account) {
        throw new Error('Currency account not found or inactive');
      }

      // Calculate new balance based on transaction type
      let newBalance = account.balance;
      const isDebit = ['withdrawal', 'transfer_out', 'fee'].includes(type);
      
      if (isDebit) {
        if (account.balance < amount) {
          throw new Error('Insufficient balance');
        }
        newBalance = account.balance - amount;
      } else {
        newBalance = account.balance + amount;
      }

      // Update account balance
      await CurrencyAccount.findByIdAndUpdate(
        accountId,
        { 
          balance: newBalance,
          lastTransactionDate: new Date()
        },
        { session }
      );

      // Generate transaction ID
      const txnTimestamp = Date.now().toString(36);
      const txnRandom = Math.random().toString(36).substring(2, 10);
      const transactionId = `TXN-${txnTimestamp}-${txnRandom}`.toUpperCase();

      // Create transaction record
      const transaction = new CurrencyTransaction({
        user: userId,
        currencyAccount: accountId,
        transactionId: transactionId,
        type: type,
        amount: amount,
        currency: account.currency,
        balanceAfter: newBalance,
        description: description,
        status: 'completed',
        metadata: metadata
      });

      await transaction.save({ session });

      await session.commitTransaction();
      
      return {
        success: true,
        transaction: transaction,
        newBalance: newBalance
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get account balance
   * @param {string} userId - User ID
   * @param {string} accountId - Currency account ID
   */
  static async getAccountBalance(userId, accountId) {
    const account = await CurrencyAccount.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      throw new Error('Currency account not found');
    }

    return {
      balance: account.balance,
      currency: account.currency,
      formatted: account.getFormattedBalance()
    };
  }

  /**
   * Transfer between currency accounts (same user)
   * @param {string} userId - User ID
   * @param {string} fromAccountId - Source account ID
   * @param {string} toAccountId - Destination account ID
   * @param {number} amount - Transfer amount
   * @param {string} description - Transfer description
   */
  static async transferBetweenAccounts(userId, fromAccountId, toAccountId, amount, description) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Process withdrawal from source account
      await this.processTransaction(
        userId, 
        fromAccountId, 
        'transfer_out', 
        amount, 
        `Transfer to account: ${description}`,
        { toAccount: toAccountId }
      );

      // Process deposit to destination account
      await this.processTransaction(
        userId, 
        toAccountId, 
        'transfer_in', 
        amount, 
        `Transfer from account: ${description}`,
        { fromAccount: fromAccountId }
      );

      await session.commitTransaction();
      
      return { success: true };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get supported currencies with their details
   */
  static getSupportedCurrencies() {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
      { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 }
    ];
  }
}

module.exports = CurrencyService;