require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Swagger
const { swaggerUi, specs } = require('./config/swagger');

// Models
const User = require('./models/User');

// Routes
const authRoutes = require('./routes/auth');
const personalRoutes = require('./routes/personal');
const businessRoutes = require('./routes/business');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const setupRoutes = require('./routes/setup');
const plaidRoutes = require('./routes/plaid');
const cardRoutes = require('./routes/card');
const supportRoutes = require('./routes/support');
const currencyRoutes = require('./routes/currency');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://helvitafrontend.vercel.app',
    'https://stingray-app-kqakx.ondigitalocean.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'helvita backend is running sucessfully' });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// For Vercel: Store raw body for webhook routes BEFORE any body parsing
app.use('/api/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Store the raw body for Stripe webhook verification
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
  }
  next();
}, webhookRoutes);

// Apply JSON parsing for all other routes
app.use(express.json());

// Other routes
app.use('/api/auth', authRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/card', cardRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/currency', currencyRoutes);

// MongoDB connection with proper async handling
const connectDB = async () => {
  try {
    // Don't disable buffering initially
    const conn = await mongoose.connect(process.env.MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
    });
    
    console.log('MongoDB connected successfully');
    // Clean up stale indexes that might cause duplicate key errors
    await User.cleanupIndexes();
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log('Retrying MongoDB connection...');
      connectDB();
    }, 5000);
    throw error;
  }
};

// Initialize connection
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`helvita backend is running successfully on port ${PORT}`));