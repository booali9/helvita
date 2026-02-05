const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CurrencyAccount = require('../models/CurrencyAccount');
const CurrencyTransaction = require('../models/CurrencyTransaction');
const User = require('../models/User');
const CurrencyService = require('../services/currencyService');
const BankIntegrationService = require('../services/bankIntegrationService');
const ExchangeRateService = require('../services/exchangeRateService');
const { body, validationResult } = require('express-validator');

// Middleware to verify JWT token
const verifyToken = require('../middlewares/auth');
const checkDBConnection = require('../middlewares/dbCheck');

/**
 * @swagger
 * /api/currency/test:
 *   get:
 *     summary: Test currency API endpoint
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test successful
 */
router.get('/test', verifyToken, async (req, res) => {
  try {
    // Test database connection
    const userCount = await User.countDocuments();
    const accountCount = await CurrencyAccount.countDocuments();
    
    res.json({ 
      message: 'Currency API is working',
      userId: req.userId,
      timestamp: new Date().toISOString(),
      dbConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      dbStats: {
        totalUsers: userCount,
        totalCurrencyAccounts: accountCount
      }
    });
  } catch (error) {
    console.error('Currency test error:', error);
    res.status(500).json({ 
      error: error.message,
      dbConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };
    
    res.json({
      status: 'OK',
      database: {
        state: dbState,
        status: states[dbState] || 'Unknown'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     CurrencyAccount:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         currency:
 *           type: string
 *           enum: [USD, CAD, EUR, GBP, JPY, AUD, CHF, CNY, NZD, HKD]
 *         balance:
 *           type: number
 *         accountNumber:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/currency/accounts:
 *   get:
 *     summary: Get all currency accounts for user
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of currency accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CurrencyAccount'
 */
router.get('/accounts', verifyToken, checkDBConnection, async (req, res) => {
  try {
    const accounts = await CurrencyAccount.find({ 
      user: req.userId, 
      isActive: true 
    }).sort({ currency: 1 });

    const accountsWithFormatted = accounts.map(account => ({
      ...account.toObject(),
      formattedBalance: account.getFormattedBalance()
    }));

    res.json({ accounts: accountsWithFormatted });
  } catch (error) {
    console.error('Error fetching currency accounts:', error);
    res.status(500).json({ error: 'Failed to fetch currency accounts' });
  }
});

/**
 * @swagger
 * /api/currency/accounts:
 *   post:
 *     summary: Create a new currency account
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency:
 *                 type: string
 *                 enum: [USD, CAD, EUR, GBP, JPY, AUD, CHF, CNY, NZD, HKD]
 *     responses:
 *       201:
 *         description: Currency account created successfully
 *       400:
 *         description: Invalid currency or account already exists
 */
router.post('/accounts', [
  verifyToken,
  checkDBConnection,
  body('currency').isIn(['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'NZD', 'HKD'])
    .withMessage('Invalid currency')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currency } = req.body;
    const userId = new mongoose.Types.ObjectId(req.userId);

    console.log('Creating currency account:', { userId: req.userId, currency });

    // Check if account already exists
    const existingAccount = await CurrencyAccount.findOne({
      user: userId,
      currency: currency
    });

    if (existingAccount) {
      console.log('Account already exists:', existingAccount._id);
      return res.status(400).json({ error: 'Currency account already exists' });
    }

    // Generate account number
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const accountNumber = `${currency}-${timestamp}-${random}`;

    console.log('Generated account number:', accountNumber);

    // Create new currency account
    const currencyAccount = new CurrencyAccount({
      user: userId,
      currency: currency,
      accountNumber: accountNumber
    });

    console.log('Saving currency account...');
    await currencyAccount.save();
    console.log('Currency account saved:', currencyAccount._id);

    // Add account reference to user
    await User.findByIdAndUpdate(userId, {
      $push: { currencyAccounts: currencyAccount._id }
    });

    // Generate transaction ID
    const txnTimestamp = Date.now().toString(36);
    const txnRandom = Math.random().toString(36).substring(2, 10);
    const transactionId = `TXN-${txnTimestamp}-${txnRandom}`.toUpperCase();

    // Create initial transaction record
    const initialTransaction = new CurrencyTransaction({
      user: userId,
      currencyAccount: currencyAccount._id,
      transactionId: transactionId,
      type: 'deposit',
      amount: 0,
      currency: currency,
      balanceAfter: 0,
      description: 'Account created',
      status: 'completed'
    });

    await initialTransaction.save();

    res.status(201).json({ 
      message: 'Currency account created successfully',
      account: {
        ...currencyAccount.toObject(),
        formattedBalance: currencyAccount.getFormattedBalance()
      }
    });
  } catch (error) {
    console.error('Error creating currency account:', error);
    
    // Handle specific MongoDB errors
    if (error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        error: 'Database connection issue. Please try again in a moment.',
        details: 'The database connection is not ready.'
      });
    }
    
    if (error.message.includes('Cannot call') && error.message.includes('before initial connection')) {
      return res.status(503).json({ 
        error: 'Database is connecting. Please wait a moment and try again.',
        details: 'Database connection is being established.'
      });
    }
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Account already exists for this currency' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create currency account',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/currency/accounts/{accountId}/transactions:
 *   get:
 *     summary: Get transaction history for a currency account
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get('/accounts/:accountId/transactions', verifyToken, checkDBConnection, async (req, res) => {
  try {
    const { accountId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify account belongs to user
    const account = await CurrencyAccount.findOne({
      _id: accountId,
      user: req.userId
    });

    if (!account) {
      return res.status(404).json({ error: 'Currency account not found' });
    }

    const transactions = await CurrencyTransaction.find({
      currencyAccount: accountId,
      user: req.userId
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await CurrencyTransaction.countDocuments({
      currencyAccount: accountId,
      user: req.userId
    });

    const transactionsWithFormatted = transactions.map(transaction => ({
      ...transaction.toObject(),
      formattedAmount: transaction.getFormattedAmount()
    }));

    res.json({
      transactions: transactionsWithFormatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * @swagger
 * /api/currency/supported:
 *   get:
 *     summary: Get list of supported currencies
 *     tags: [Currency]
 *     responses:
 *       200:
 *         description: List of supported currencies
 */
router.get('/supported', (req, res) => {
  const currencies = CurrencyService.getSupportedCurrencies();
  res.json({ currencies });
});

/**
 * @swagger
 * /api/currency/accounts/{accountId}/deposit:
 *   post:
 *     summary: Add funds to a currency account (for testing)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit successful
 */
router.post('/accounts/:accountId/deposit', [
  verifyToken,
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountId } = req.params;
    const { amount, description = 'Test deposit' } = req.body;

    const result = await CurrencyService.processTransaction(
      req.userId,
      accountId,
      'deposit',
      amount,
      description
    );

    res.json({
      message: 'Deposit successful',
      transaction: result.transaction,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ error: error.message || 'Failed to process deposit' });
  }
});

/**
 * @swagger
 * /api/currency/accounts/{accountId}/withdraw:
 *   post:
 *     summary: Withdraw funds from a currency account (for testing)
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal successful
 */
router.post('/accounts/:accountId/withdraw', [
  verifyToken,
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountId } = req.params;
    const { amount, description = 'Test withdrawal' } = req.body;

    const result = await CurrencyService.processTransaction(
      req.userId,
      accountId,
      'withdrawal',
      amount,
      description
    );

    res.json({
      message: 'Withdrawal successful',
      transaction: result.transaction,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ error: error.message || 'Failed to process withdrawal' });
  }
});

/**
 * @swagger
 * /api/currency/supported:
 *   get:
 *     summary: Get list of supported currencies
 *     tags: [Currency]
 *     responses:
 *       200:
 *         description: List of supported currencies
 */
router.get('/supported', (req, res) => {
  const currencies = CurrencyAccount.getSupportedCurrencies();
  const currencyDetails = currencies.map(code => {
    const details = {
      USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
      CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
      GBP: { code: 'GBP', name: 'British Pound', symbol: '£' },
      JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
      CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
      HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' }
    };
    return details[code];
  });

  res.json({ currencies: currencyDetails });
});

/**
 * @swagger
 * /api/currency/dashboard:
 *   get:
 *     summary: Get currency dashboard data
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data with all accounts and recent transactions
 */
router.get('/dashboard', verifyToken, checkDBConnection, async (req, res) => {
  try {
    // Ensure user ID exists
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get all active accounts
    const accounts = await CurrencyAccount.find({ 
      user: req.userId, 
      isActive: true 
    }).sort({ currency: 1 });

    // Get recent transactions across all accounts (only if accounts exist)
    let recentTransactions = [];
    if (accounts.length > 0) {
      recentTransactions = await CurrencyTransaction.find({
        user: req.userId
      })
      .populate('currencyAccount', 'currency accountNumber')
      .sort({ createdAt: -1 })
      .limit(10);
    }

    const accountsWithFormatted = accounts.map(account => ({
      ...account.toObject(),
      formattedBalance: account.getFormattedBalance()
    }));

    const transactionsWithFormatted = recentTransactions.map(transaction => ({
      ...transaction.toObject(),
      formattedAmount: transaction.getFormattedAmount()
    }));

    // Calculate total portfolio value (in USD equivalent - simplified)
    const totalAccounts = accounts.length;
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

    res.json({
      accounts: accountsWithFormatted,
      recentTransactions: transactionsWithFormatted,
      summary: {
        totalAccounts,
        totalBalance: totalBalance.toFixed(2),
        activeCurrencies: accounts.map(acc => acc.currency)
      }
    });
  } catch (error) {
    console.error('Error fetching currency dashboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/currency/accounts/{accountId}:
 *   get:
 *     summary: Get specific currency account details
 *     tags: [Currency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Currency account details
 *       404:
 *         description: Account not found
 */
router.get('/accounts/:accountId', verifyToken, checkDBConnection, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await CurrencyAccount.findOne({
      _id: accountId,
      user: req.userId
    });

    if (!account) {
      return res.status(404).json({ error: 'Currency account not found' });
    }

    res.json({
      account: {
        ...account.toObject(),
        formattedBalance: account.getFormattedBalance()
      }
    });
  } catch (error) {
    console.error('Error fetching currency account:', error);
    res.status(500).json({ error: 'Failed to fetch currency account' });
  }
});

// Bank Integration Endpoints

router.post('/accounts/:accountId/fund-from-bank', [
  verifyToken,
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountId } = req.params;
    const { amount, description = 'Bank transfer' } = req.body;

    const result = await BankIntegrationService.fundFromBank(
      req.userId,
      accountId,
      amount,
      description
    );

    res.json({
      message: 'Funding successful',
      ...result
    });

  } catch (error) {
    console.error('Error funding from bank:', error);
    res.status(500).json({ error: error.message || 'Failed to fund from bank' });
  }
});

router.post('/accounts/:accountId/withdraw-to-bank', [
  verifyToken,
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountId } = req.params;
    const { amount, description = 'Bank withdrawal' } = req.body;

    const result = await BankIntegrationService.withdrawToBank(
      req.userId,
      accountId,
      amount,
      description
    );

    res.json({
      message: 'Withdrawal successful',
      ...result
    });

  } catch (error) {
    console.error('Error withdrawing to bank:', error);
    res.status(500).json({ error: error.message || 'Failed to withdraw to bank' });
  }
});

router.post('/exchange', [
  verifyToken,
  body('fromAccountId').notEmpty().withMessage('From account ID is required'),
  body('toAccountId').notEmpty().withMessage('To account ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fromAccountId, toAccountId, amount } = req.body;

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Cannot exchange to the same account' });
    }

    const result = await BankIntegrationService.exchangeCurrency(
      req.userId,
      fromAccountId,
      toAccountId,
      amount
    );

    res.json({
      message: 'Exchange successful',
      ...result
    });

  } catch (error) {
    console.error('Error exchanging currency:', error);
    res.status(500).json({ error: error.message || 'Failed to exchange currency' });
  }
});

router.get('/exchange-rate', async (req, res) => {
  try {
    const { from, to, amount = 1 } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to currencies are required' });
    }

    const conversion = await ExchangeRateService.convertAmount(
      parseFloat(amount),
      from.toUpperCase(),
      to.toUpperCase()
    );

    const fee = ExchangeRateService.calculateFee(parseFloat(amount));

    res.json({
      ...conversion,
      fee: fee,
      netAmount: parseFloat(amount) - fee,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting exchange rate:', error);
    res.status(500).json({ error: error.message || 'Failed to get exchange rate' });
  }
});

router.get('/bank-info', verifyToken, async (req, res) => {
  try {
    const bankInfo = await BankIntegrationService.getBankAccountInfo(req.userId);
    res.json(bankInfo);
  } catch (error) {
    console.error('Error getting bank info:', error);
    res.status(500).json({ error: error.message || 'Failed to get bank info' });
  }
});

// Helper function to generate transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `TXN-${timestamp}-${random}`.toUpperCase();
};

// Sync USD account balance with Plaid bank balance
router.post('/sync-plaid', verifyToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.status(400).json({ error: 'No Plaid account connected' });
    }

    // Get Plaid accounts balance
    const plaidService = require('../services/plaidService');
    const accounts = await plaidService.getAccounts(user.plaidAccessToken);
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balances.available || acc.balances.current || 0), 0);

    // Find or create USD account
    let usdAccount = await CurrencyAccount.findOne({
      user: userId,
      currency: 'USD'
    });

    if (!usdAccount) {
      // Create USD account
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const accountNumber = `USD-${timestamp}-${random}`;

      usdAccount = new CurrencyAccount({
        user: userId,
        currency: 'USD',
        balance: totalBalance,
        accountNumber: accountNumber
      });

      await usdAccount.save();

      // Add account reference to user
      await User.findByIdAndUpdate(userId, {
        $push: { currencyAccounts: usdAccount._id }
      });

      // Create initial funding transaction
      const fundingTransaction = new CurrencyTransaction({
        user: userId,
        currencyAccount: usdAccount._id,
        transactionId: generateTransactionId(),
        type: 'deposit',
        amount: totalBalance,
        currency: 'USD',
        balanceAfter: totalBalance,
        description: 'Initial funding from Plaid bank account',
        status: 'completed',
        metadata: { source: 'plaid' }
      });

      await fundingTransaction.save();
    } else {
      // Update balance if changed
      const previousBalance = usdAccount.balance;
      if (previousBalance !== totalBalance) {
        usdAccount.balance = totalBalance;
        await usdAccount.save();

        // Create sync transaction
        const syncTransaction = new CurrencyTransaction({
          user: userId,
          currencyAccount: usdAccount._id,
          transactionId: generateTransactionId(),
          type: totalBalance > previousBalance ? 'deposit' : 'withdrawal',
          amount: Math.abs(totalBalance - previousBalance),
          currency: 'USD',
          balanceAfter: totalBalance,
          description: 'Balance synced with Plaid bank account',
          status: 'completed',
          metadata: { source: 'plaid_sync' }
        });

        await syncTransaction.save();
      }
    }

    res.json({
      success: true,
      account: {
        ...usdAccount.toObject(),
        formattedBalance: usdAccount.getFormattedBalance()
      },
      plaidBalance: totalBalance
    });

  } catch (error) {
    console.error('Error syncing with Plaid:', error);
    res.status(500).json({ error: error.message || 'Failed to sync with Plaid' });
  }
});

module.exports = router;