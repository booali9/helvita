const nodemailer = require('nodemailer');
const User = require('../models/User');

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'OTP for Verification',
    text: `Your OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY} minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP sent to', email);
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP');
  }
};

const verifyOTP = async (email, otp) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }

  if (user.otp !== otp || user.otpExpires < Date.now()) {
    throw new Error('Invalid or expired OTP');
  }

  user.emailVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  return user;
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP
};