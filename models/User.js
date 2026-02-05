const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    accountType: {
      type: String,
      enum: ["personal", "business"],
      required: true,
    },
    emailVerified: { type: Boolean, default: false },
    identityVerified: { type: Boolean, default: false },
    adminApproved: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpires: { type: Date },
    stripeCustomerId: { type: String },
    stripeIdentitySessionId: { type: String },
    stripeIdentityId: { type: String },
    businessStripeIdentityId: { type: String },
    currentVerificationSessionId: { type: String },
    documentVerificationStatus: {
      type: String,
      enum: [
        "pending",
        "verified",
        "unverified",
        "requires_input",
        "processing",
        "canceled",
      ],
      default: "pending",
    },
    documentVerificationDate: { type: Date },
    stripeCardId: { type: String },
    stripeCardholderId: { type: String },
    cardHolderName: { type: String },
    cardName: { type: String },
    businessNameOnCard: { type: String },
    plaidAccessToken: { type: String },
    plaidItemId: { type: String },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Track sent referral invites - each user has their own array
    sentReferrals: {
      type: [
        {
          email: { type: String },
          name: { type: String },
          sentAt: { type: Date, default: Date.now },
          status: {
            type: String,
            enum: ["Pending", "Registered", "Completed"],
            default: "Pending",
          },
          registeredUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          registeredAt: { type: Date },
        },
      ],
      default: [],
    },
    // Saved external cards - each user has their own array
    savedCards: {
      type: [
        {
          id: { type: String },
          last4: { type: String },
          brand: { type: String },
          cardholderName: { type: String },
          expMonth: { type: Number },
          expYear: { type: Number },
          cardType: { type: String },
          addedAt: { type: Date },
        },
      ],
      default: [],
    },
    // Track transfers made by the user
    transfers: {
      type: [
        {
          id: { type: String },
          stripePaymentIntentId: { type: String },
          amount: { type: Number },
          destination: { type: String },
          status: {
            type: String,
            enum: [
              "pending",
              "completed",
              "failed",
              "recorded",
              "pending_processing",
            ],
            default: "pending",
          },
          description: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    personalProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PersonalProfile",
    },
    businessProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
    },
    // Multi-currency accounts
    currencyAccounts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "CurrencyAccount",
    }],
  },
  { timestamps: true },
);

// Pre-save hook to ensure arrays are initialized
userSchema.pre("save", function (next) {
  if (!this.savedCards) this.savedCards = [];
  if (!this.sentReferrals) this.sentReferrals = [];
  next();
});

// Drop any stale indexes that might cause issues (like username_1)
userSchema.statics.cleanupIndexes = async function () {
  try {
    const indexes = await this.collection.indexes();
    const staleIndexes = ["username_1", "activation_key_1"]; // Add any other stale index names here

    for (const index of indexes) {
      if (staleIndexes.includes(index.name)) {
        console.log(`Dropping stale index: ${index.name}`);
        await this.collection.dropIndex(index.name);
      }
    }
  } catch (error) {
    // Index might not exist, which is fine
    if (error.code !== 27) {
      // 27 = IndexNotFound
      console.error("Error cleaning up indexes:", error.message);
    }
  }
};

module.exports = mongoose.model("User", userSchema);
