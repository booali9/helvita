const nodemailer = require('nodemailer');

// Send support message
const sendSupportMessage = async (req, res) => {
  const { subject, message } = req.body;
  const userEmail = req.user.email;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: userEmail,
    to: process.env.EMAIL_USER, // Send to support email
    subject: `Support: ${subject}`,
    text: `From: ${userEmail}\n\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Support message sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Send notification
const sendNotification = async (req, res) => {
  const { to, subject, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

module.exports = {
  sendSupportMessage,
  sendNotification,
};