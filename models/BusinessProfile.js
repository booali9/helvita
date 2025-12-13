const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  investmentType: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  zipcode: { type: String, required: true },
  residentialAddress: { type: String, required: true },
  businessType: { type: String, required: true },
  roleInBusiness: { type: String, required: true },
  ownershipPercentage: { type: Number, required: true },
  businessRegisteredState: { type: String, required: true },
  businessAddress: { type: String, required: true },
  businessPhone: { type: String, required: true },
  EIN: { type: String, required: true },
  businessStartDate: { type: Date, required: true },
  websiteOrSocialLink: { type: String },
  monthlyRevenue: { type: Number, required: true },
  transferPurpose: { type: String, required: true },
  stripeVerificationStatus: { type: String, default: 'pending' },
  // Debit card details
  nameOnCard: { type: String },
  businessNameOnCard: { type: String },
  cardDeliveryEmail: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);