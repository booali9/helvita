const plaidService = require('../services/plaidService');
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

// Initiate a transfer (simplified - actual Plaid transfers require more setup)
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

    // Note: Actual Plaid Transfer API requires additional setup including:
    // - Transfer authorization
    // - ACH processing
    // - Compliance checks
    // This is a simplified placeholder that logs the transfer request
    
    console.log('Transfer request:', {
      userId,
      from: 'User linked account',
      to: accountNumber,
      amount,
      description: description || 'Transfer',
      timestamp: new Date().toISOString()
    });

    // In production, you would:
    // 1. Create a transfer authorization with Plaid
    // 2. Execute the transfer
    // 3. Store transfer record in database
    // 4. Return transfer confirmation

    res.json({
      success: true,
      message: 'Transfer initiated successfully',
      transfer: {
        id: `TRF_${Date.now()}`,
        amount,
        destination: accountNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
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
};