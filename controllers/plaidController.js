const plaidService = require('../services/plaidService');
const stripeService = require('../services/stripeService');
const User = require('../models/User');

// Create link token for Plaid Link
const createLinkToken = async (req, res) => {
  try {
    const userId = req.userId;
    const linkToken = await plaidService.createLinkToken(userId);
    res.json({ linkToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exchange public token for access token
const exchangePublicToken = async (req, res) => {
  try {
    const { publicToken } = req.body;
    const userId = req.userId;

    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);

    // Save to user
    await User.findByIdAndUpdate(userId, {
      plaidAccessToken: accessToken,
      plaidItemId: itemId,
    });

    res.json({ message: 'Account linked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get transactions
const getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.json({ transactions: [] });
    }

    const { startDate, endDate } = req.query;
    const transactions = await plaidService.getTransactions(
      user.plaidAccessToken,
      startDate || '2020-01-01',
      endDate || new Date().toISOString().split('T')[0]
    );

    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get accounts
const getAccounts = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.json({ accounts: [] });
    }

    const accounts = await plaidService.getAccounts(user.plaidAccessToken);
    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get transaction summary
const getTransactionSummary = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.json({ totalTransactions: 0, totalAmount: 0, transactions: [] });
    }

    const transactions = await plaidService.getTransactions(
      user.plaidAccessToken,
      '2020-01-01',
      new Date().toISOString().split('T')[0]
    );

    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    res.json({
      totalTransactions,
      totalAmount,
      transactions: transactions.slice(0, 10), // Last 10 for summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get connected card details
const getCardDetails = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.json({ cards: [] });
    }

    const accounts = await plaidService.getAccounts(user.plaidAccessToken);

    // Filter for credit/debit accounts (cards)
    const cards = accounts.filter(account =>
      account.type === 'credit' || account.type === 'depository'
    ).map(account => ({
      id: account.account_id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      balance: account.balances.current,
      available: account.balances.available,
      currency: account.balances.iso_currency_code
    }));

    res.json({ cards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all reserves (balances)
const getReserves = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.plaidAccessToken) {
      return res.json({ totalReserves: 0, currency: 'USD', accounts: [] });
    }

    const accounts = await plaidService.getAccounts(user.plaidAccessToken);

    const reserves = accounts.map(account => ({
      accountId: account.account_id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      currentBalance: account.balances.current,
      availableBalance: account.balances.available,
      currency: account.balances.iso_currency_code
    }));

    const totalReserves = reserves.reduce((total, account) => total + (account.availableBalance || 0), 0);

    res.json({
      totalReserves,
      currency: 'USD', // Assuming USD
      accounts: reserves
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Initiate a transfer (connected to Stripe for actual payment processing)
const initiateTransfer = async (req, res) => {
  try {
    const userId = req.userId;
    const { accountNumber, amount, description } = req.body;
    const user = await User.findById(userId);

    if (!user.plaidAccessToken) {
      return res.status(400).json({ error: 'No linked account. Please link a bank account first.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!accountNumber) {
      return res.status(400).json({ error: 'Please enter a destination account number' });
    }

    // Create a Stripe PaymentIntent to track this transfer
    // This will appear in your Stripe Dashboard
    const stripeTransfer = await stripeService.createTransfer(
      userId,
      amount,
      accountNumber,
      description || 'Bank Transfer from Helvita'
    );

    console.log('Stripe transfer created:', stripeTransfer);

    // Record the transfer
    await stripeService.recordTransfer(userId, {
      stripePaymentIntentId: stripeTransfer.id,
      amount,
      destination: accountNumber,
      status: stripeTransfer.status
    });

    res.json({
      success: true,
      message: 'Transfer initiated successfully',
      transfer: {
        id: stripeTransfer.id,
        amount,
        destination: accountNumber,
        status: stripeTransfer.status,
        clientSecret: stripeTransfer.clientSecret, // For frontend confirmation if needed
        createdAt: stripeTransfer.createdAt
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Quick Transfer to linked Plaid account
const quickTransfer = async (req, res) => {
  try {
    const userId = req.userId;
    const { amount, saveAsDraft } = req.body;
    const user = await User.findById(userId);

    if (!user.plaidAccessToken) {
      return res.status(400).json({ error: 'No linked account. Please link a bank account first.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // If saving as draft, just return success without processing
    if (saveAsDraft) {
      return res.json({
        success: true,
        message: 'Transfer saved as draft',
        draft: {
          id: `DRAFT_${Date.now()}`,
          amount,
          status: 'draft',
          createdAt: new Date().toISOString()
        }
      });
    }

    // Get the linked Plaid account info
    const accounts = await plaidService.getAccounts(user.plaidAccessToken);
    const primaryAccount = accounts[0]; // Use first linked account

    if (!primaryAccount) {
      return res.status(400).json({ error: 'No linked bank account found' });
    }

    // Create a Stripe PaymentIntent for the quick transfer
    const stripeTransfer = await stripeService.createTransfer(
      userId,
      amount,
      `Plaid-${primaryAccount.account_id}`,
      'Quick Transfer to linked account'
    );

    console.log('Quick transfer created:', stripeTransfer);

    res.json({
      success: true,
      message: 'Transfer completed successfully',
      transfer: {
        id: stripeTransfer.id,
        amount,
        destination: primaryAccount.name || 'Linked Account',
        accountMask: primaryAccount.mask,
        status: stripeTransfer.status,
        createdAt: stripeTransfer.createdAt
      }
    });
  } catch (error) {
    console.error('Quick transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Unlink Plaid bank account
const unlinkAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.plaidAccessToken) {
      return res.status(400).json({ error: 'No linked account to unlink' });
    }

    // Clear Plaid tokens from user
    user.plaidAccessToken = null;
    user.plaidItemId = null;
    await user.save();

    console.log('Bank account unlinked for user:', userId);

    res.json({
      success: true,
      message: 'Bank account unlinked successfully'
    });
  } catch (error) {
    console.error('Unlink account error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user's transfer history
const getTransfers = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return transfers sorted by date (newest first)
    const transfers = (user.transfers || []).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      transfers: transfers,
      totalTransfers: transfers.length
    });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createLinkToken,
  exchangePublicToken,
  getTransactions,
  getAccounts,
  getTransactionSummary,
  getCardDetails,
  getReserves,
  initiateTransfer,
  quickTransfer,
  unlinkAccount,
  getTransfers,
};