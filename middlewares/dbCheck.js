const mongoose = require('mongoose');

const checkDBConnection = (req, res, next) => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    console.log('Database not ready, current state:', mongoose.connection.readyState);
    return res.status(503).json({ 
      error: 'Database connection not ready. Please try again in a moment.',
      details: 'The database is currently connecting or disconnected.'
    });
  }
  next();
};

module.exports = checkDBConnection;