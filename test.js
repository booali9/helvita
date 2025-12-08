const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  accountType: 'personal'
};

let token = '';

async function testRoot() {
  try {
    console.log('Testing root endpoint...');
    const response = await axios.get('http://127.0.0.1:5000/');
    console.log('Root response:', response.data);
  } catch (error) {
    console.log('Root error:', error.response?.data || error.message);
  }
}

async function testRegister() {
  try {
    console.log('Testing registration...');
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('Registration response:', response.data);
  } catch (error) {
    console.log('Registration error:', error.response?.data || error.message);
  }
}

async function testVerifyOtp() {
  try {
    console.log('Testing OTP verification...');
    // Assume OTP is logged in console - for demo, skip or use known OTP
    const response = await axios.post(`${BASE_URL}/auth/verify-otp`, {
      email: testUser.email,
      otp: '123456' // This will fail unless OTP is 123456
    });
    console.log('OTP verification response:', response.data);
  } catch (error) {
    console.log('OTP verification error:', error.response?.data || error.message);
  }
}

async function testLogin() {
  try {
    console.log('Testing login...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    token = response.data.token;
    console.log('Login response:', response.data);
  } catch (error) {
    console.log('Login error:', error.response?.data || error.message);
  }
}

async function testPlaidLinkToken() {
  if (!token) return console.log('Skipping Plaid test - no token');
  try {
    console.log('Testing Plaid link token...');
    const response = await axios.post(`${BASE_URL}/plaid/create-link-token`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Link token response:', response.data);
  } catch (error) {
    console.log('Link token error:', error.response?.data || error.message);
  }
}

async function testReferralLink() {
  if (!token) return console.log('Skipping referral test - no token');
  try {
    console.log('Testing referral link...');
    const response = await axios.get(`${BASE_URL}/auth/referral-link`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Referral link response:', response.data);
  } catch (error) {
    console.log('Referral link error:', error.response?.data || error.message);
  }
}

async function testSupportMessage() {
  if (!token) return console.log('Skipping support test - no token');
  try {
    console.log('Testing support message...');
    const response = await axios.post(`${BASE_URL}/support/message`, {
      subject: 'Test Support',
      message: 'This is a test message'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Support message response:', response.data);
  } catch (error) {
    console.log('Support message error:', error.response?.data || error.message);
  }
}

async function testCardRequest() {
  if (!token) return console.log('Skipping card request test - no token');
  try {
    console.log('Testing card request...');
    const response = await axios.post(`${BASE_URL}/card/request`, {
      nameOnCard: 'Test User',
      cardDeliveryAddress: '123 Test St'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Card request response:', response.data);
  } catch (error) {
    console.log('Card request error:', error.response?.data || error.message);
  }
}

async function runTests() {
  await testRoot();
  await testRegister();
  await testVerifyOtp(); // Will likely fail without real OTP
  await testLogin(); // May fail if OTP not verified
  await testPlaidLinkToken();
  await testReferralLink();
  await testSupportMessage();
  await testCardRequest();
  console.log('All tests completed!');
}

runTests();