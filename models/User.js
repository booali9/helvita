const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountType: { type: String, enum: ['personal', 'business'], required: true },
  emailVerified: { type: Boolean, default: false },
  identityVerified: { type: Boolean, default: false },
  adminApproved: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  stripeCustomerId: { type: String },
  stripeIdentitySessionId: { type: String },
  stripeCardId: { type: String },
  personalProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalProfile' },
  businessProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);