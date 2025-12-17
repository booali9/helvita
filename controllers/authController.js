const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PersonalProfile = require("../models/PersonalProfile");
const BusinessProfile = require("../models/BusinessProfile");
const { validationResult } = require("express-validator");
const otpService = require("../services/otpService");
const jwtService = require("../services/jwtService");
const stripeService = require("../services/stripeService");
const axios = require("axios");

// Register user
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, accountType, referralCode } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique referral code
    const userReferralCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer._id;

        // Update referrer's sentReferrals if this email exists
        const referralIndex = referrer.sentReferrals?.findIndex(
          (r) => r.email.toLowerCase() === email.toLowerCase(),
        );
        if (referralIndex >= 0) {
          referrer.sentReferrals[referralIndex].status = "Registered";
          referrer.sentReferrals[referralIndex].registeredAt = new Date();
          referrer.sentReferrals[referralIndex].name = email.split("@")[0];
        } else {
          // Add to sentReferrals even if invite wasn't tracked (direct link share)
          if (!referrer.sentReferrals) referrer.sentReferrals = [];
          referrer.sentReferrals.push({
            email: email,
            name: email.split("@")[0],
            sentAt: new Date(),
            status: "Registered",
            registeredAt: new Date(),
          });
        }
        await referrer.save();
      }
    }

    user = new User({
      email,
      password: hashedPassword,
      accountType,
      referralCode: userReferralCode,
      referredBy,
      savedCards: [],
      sentReferrals: [],
    });

    await user.save();

    // Generate and send OTP
    const otp = otpService.generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + parseInt(process.env.OTP_EXPIRY) * 60 * 1000;
    await user.save();

    // Log OTP to console for testing
    console.log("=================================");
    console.log(`OTP for ${email}: ${otp}`);
    console.log("=================================");

    await otpService.sendOTP(email, otp);

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp } = req.body;

  try {
    const user = await otpService.verifyOTP(email, otp);
    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Login
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(400).json({ error: "Email not verified" });
    }

    if (!user.identityVerified) {
      return res.status(400).json({ error: "Identity not verified" });
    }

    // Admin approval check disabled for testing
    // if (!user.adminApproved) {
    //   return res.status(400).json({ error: 'Account not approved by admin' });
    // }

    const token = jwtService.generateToken(user._id);
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get user profile with card details
const getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select(
      "-password -otp -otpExpires",
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get profile based on account type
    let profile = null;
    if (user.accountType === "personal") {
      profile = await PersonalProfile.findOne({ user: userId });
    } else if (user.accountType === "business") {
      profile = await BusinessProfile.findOne({ user: userId });
    }

    // Get card details if user has a Stripe card
    let cardDetails = null;
    if (user.stripeCardId) {
      cardDetails = await stripeService.getCardDetails(user.stripeCardId);
    }

    // If no Stripe card but user has card name stored, create virtual card details
    if (!cardDetails && (user.cardHolderName || user.cardName)) {
      cardDetails = {
        id: "pending",
        last4: "****",
        expMonth: new Date().getMonth() + 1,
        expYear: new Date().getFullYear() + 3,
        brand: "visa",
        status: "pending",
        type: "virtual",
        cardholderName: user.cardHolderName || user.cardName || "Card Holder",
        created: user.createdAt,
      };
    }

    // Build response
    const response = {
      user: {
        id: user._id,
        email: user.email,
        accountType: user.accountType,
        emailVerified: user.emailVerified,
        identityVerified: user.identityVerified,
        adminApproved: user.adminApproved,
        referralCode: user.referralCode,
        hasCard: !!user.stripeCardId,
        hasLinkedBank: !!user.plaidAccessToken,
        createdAt: user.createdAt,
        cardHolderName: user.cardHolderName || user.cardName || null,
        businessNameOnCard: user.businessNameOnCard || null,
      },
      profile: profile
        ? {
            fullName: profile.fullName || null,
            address: profile.address || profile.residentialAddress || null,
            city: profile.city || null,
            state: profile.state || null,
            zipcode: profile.zipcode || null,
            // Personal specific fields
            ...(user.accountType === "personal" && {
              dateOfBirth: profile.dateOfBirth || null,
              investmentType: profile.investmentType || null,
            }),
            // Business specific fields
            ...(user.accountType === "business" && {
              businessType: profile.businessType || null,
              roleInBusiness: profile.roleInBusiness || null,
              businessPhone: profile.businessPhone || null,
              businessAddress: profile.businessAddress || null,
              nameOnCard: profile.nameOnCard || null,
              businessNameOnCard: profile.businessNameOnCard || null,
            }),
          }
        : null,
      card: cardDetails,
      savedCards: user.savedCards || [],
    };

    res.json(response);
  } catch (err) {
    console.error("Error getting profile:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get user's referrals
const getReferrals = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select(
      "sentReferrals referralCode",
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Format referrals for display
    const referrals = (user.sentReferrals || []).map((ref) => ({
      id: ref._id,
      email: ref.email,
      name: ref.name || ref.email.split("@")[0],
      date: ref.sentAt
        ? new Date(ref.sentAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "N/A",
      status: ref.status || "Pending",
      registeredAt: ref.registeredAt,
    }));

    res.json({
      referrals,
      referralCode: user.referralCode,
      totalReferrals: referrals.length,
      completedReferrals: referrals.filter(
        (r) => r.status === "Registered" || r.status === "Completed",
      ).length,
    });
  } catch (err) {
    console.error("Error getting referrals:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete user account
const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const { password } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password if provided
    if (password) {
      const bcrypt = require("bcryptjs");
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Incorrect password" });
      }
    }

    // Delete associated profile
    const PersonalProfile = require("../models/PersonalProfile");
    const BusinessProfile = require("../models/BusinessProfile");

    if (user.accountType === "personal") {
      await PersonalProfile.findOneAndDelete({ user: userId });
    } else if (user.accountType === "business") {
      await BusinessProfile.findOneAndDelete({ user: userId });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.json({
      message: "Account deleted successfully",
      success: true,
    });
  } catch (err) {
    console.error("Error deleting account:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Forgot Password - Send OTP
const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message:
          "If an account exists with this email, you will receive a password reset OTP",
      });
    }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires =
      Date.now() + parseInt(process.env.OTP_EXPIRY || 10) * 60 * 1000;
    await user.save();

    // Log OTP to console for testing
    console.log("=================================");
    console.log(`Password Reset OTP for ${email}: ${otp}`);
    console.log("=================================");

    await otpService.sendOTP(email, otp, "Password Reset");

    res.json({ message: "Password reset OTP sent to email" });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Verify Reset OTP
const verifyResetOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (user.resetPasswordOtpExpires < Date.now()) {
      return res.status(400).json({ error: "OTP has expired" });
    }

    res.json({ message: "OTP verified successfully", valid: true });
  } catch (err) {
    console.error("Verify reset OTP error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (user.resetPasswordOtpExpires < Date.now()) {
      return res.status(400).json({ error: "OTP has expired" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset tokens
    user.password = hashedPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Google Login
const googleLogin = async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Credential is required" });
  }

  try {
    // Verify the Google ID token
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
    );
    const payload = response.data;

    if (!payload.email_verified) {
      return res.status(400).json({ error: "Email not verified by Google" });
    }

    const { email, name, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      const userReferralCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      user = new User({
        email,
        password: "", // No password for Google users
        accountType: "personal", // Default to personal
        referralCode: userReferralCode,
        referredBy: null,
        savedCards: [],
        sentReferrals: [],
        emailVerified: true, // Google verified
        identityVerified: false, // Still need identity verification
        adminApproved: true, // Auto approve for Google login
        googleId,
      });

      await user.save();
    } else {
      // Update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    // Generate JWT token
    const token = jwtService.generateToken(user._id);

    res.json({
      token,
      accountId: user._id,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Google login error:", error.message);
    res.status(500).json({ error: "Google login failed" });
  }
};

module.exports = {
  register,
  verifyOtp,
  login,
  getProfile,
  getReferrals,
  deleteAccount,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
};
