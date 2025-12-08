const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const env = process.env.PLAID_ENV || 'sandbox';
const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

const createLinkToken = async (userId) => {
  const request = {
    user: {
      client_user_id: userId.toString(),
    },
    client_name: 'Helvita',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  };

  try {
    const response = await plaidClient.linkTokenCreate(request);
    return response.data.link_token;
  } catch (error) {
    throw new Error('Error creating link token: ' + error.message);
  }
};

const exchangePublicToken = async (publicToken) => {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  } catch (error) {
    throw new Error('Error exchanging public token: ' + error.message);
  }
};

const getTransactions = async (accessToken, startDate, endDate) => {
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });
    return response.data.transactions;
  } catch (error) {
    throw new Error('Error fetching transactions: ' + error.message);
  }
};

const getAccounts = async (accessToken) => {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    return response.data.accounts;
  } catch (error) {
    throw new Error('Error fetching accounts: ' + error.message);
  }
};

module.exports = {
  createLinkToken,
  exchangePublicToken,
  getTransactions,
  getAccounts,
};