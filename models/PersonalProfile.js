const mongoose = require('mongoose');

const personalProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  investmentType: { type: String, required: true },
  fullName: { type: String, required: true },
  address: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  zipcode: { type: String, required: true },
  SSN: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  accountName: { type: String, required: true },
  accountType: { type: String, required: true },
  routingNumber: { type: String, required: true },
  accountNumber: { type: String, required: true },
  stripeVerificationStatus: { type: String, default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('PersonalProfile', personalProfileSchema);