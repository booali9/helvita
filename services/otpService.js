const nodemailer = require('nodemailer');
const User = require('../models/User');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      console.log('Transporter created successfully');
    } catch (error) {
      console.error('Error creating transporter:', error);
      throw error;
    }
  }
  return transporter;
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email, otp, purpose = 'Verification') => {
  const subject = purpose === 'Password Reset' 
    ? 'Password Reset OTP' 
    : 'OTP for Verification';
  
  const text = purpose === 'Password Reset'
    ? `Your password reset OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY || 10} minutes. If you did not request this, please ignore this email.`
    : `Your OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY || 10} minutes.`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    text: text
  };

  try {
    await getTransporter().sendMail(mailOptions);
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