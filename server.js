require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Swagger
const { swaggerUi, specs } = require('./config/swagger');

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

const app = express();

// Middleware
app.use(cors({
  origin: ['https://helvitafrontend.vercel.app', 'http://localhost:5173', 'http://localhost:3000']
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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`helvita backend is running successfully on port ${PORT}`));