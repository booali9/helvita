// Simple test script to verify currency endpoints
const axios = require('axios');

const BASE_URL = 'https://helvitabackend.vercel.app/api';
// Replace with a valid JWT token for testing
const TEST_TOKEN = 'your-jwt-token-here';

const headers = {
  'Authorization': `Bearer ${TEST_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testEndpoints() {
  console.log('🧪 Testing Currency API Endpoints...\n');

  try {
    // Test 1: Get supported currencies
    console.log('1. Testing supported currencies...');
    const supportedResponse = await axios.get(`${BASE_URL}/currency/supported`);
    console.log('✅ Supported currencies:', supportedResponse.data.currencies.length, 'currencies');

    // Test 2: Test endpoint
    console.log('\n2. Testing API connection...');
    const testResponse = await axios.get(`${BASE_URL}/currency/test`, { headers });
    console.log('✅ API test:', testResponse.data.message);

    // Test 3: Get dashboard
    console.log('\n3. Testing dashboard...');
    const dashboardResponse = await axios.get(`${BASE_URL}/currency/dashboard`, { headers });
    console.log('✅ Dashboard:', dashboardResponse.data.summary);

    // Test 4: Get bank info
    console.log('\n4. Testing bank info...');
    const bankResponse = await axios.get(`${BASE_URL}/currency/bank-info`, { headers });
    console.log('✅ Bank info:', bankResponse.data.connected ? 'Connected' : 'Not connected');

    // Test 5: Get exchange rate
    console.log('\n5. Testing exchange rate...');
    const rateResponse = await axios.get(`${BASE_URL}/currency/exchange-rate?from=USD&to=EUR&amount=100`);
    console.log('✅ Exchange rate USD->EUR:', rateResponse.data.exchangeRate);

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests
testEndpoints();