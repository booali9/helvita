const nodemailer = require('nodemailer');
const User = require('../models/User');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send referral invites
const sendReferralInvites = async (req, res) => {
  try {
    const { emails } = req.body;
    const userId = req.userId;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one email address' });
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const transporter = createTransporter();
    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${user.referralCode}`;
    const senderName = user.cardHolderName || user.email.split('@')[0];

    // Send emails to all recipients
    const results = [];
    for (const email of emails) {
      if (!email || !email.includes('@')) continue;

      const mailOptions = {
        from: `"${senderName} via Helvita" <${process.env.EMAIL_USER}>`,
        replyTo: user.email,
        to: email,
        subject: `${senderName} invited you to join Helvita!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">Helvita</h1>
              <p style="color: #6B7280; margin-top: 5px;">Modern Banking Solution</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px; padding: 30px; color: white; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0 0 10px 0;">You've been invited!</h2>
              <p style="margin: 0; opacity: 0.9;">${senderName} thinks you'd love Helvita</p>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Hi there,
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your friend <strong>${senderName}</strong> (${user.email}) has invited you to join Helvita - the modern way to manage your finances.
            </p>
            
            <div style="background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #1F2937; margin: 0 0 15px 0;">Why join Helvita?</h3>
              <ul style="color: #4B5563; padding-left: 20px; margin: 0;">
                <li style="margin-bottom: 8px;">Virtual cards for secure online payments</li>
                <li style="margin-bottom: 8px;">Easy money transfers</li>
                <li style="margin-bottom: 8px;">Real-time transaction tracking</li>
                <li style="margin-bottom: 8px;">Rewards for you and your referrer!</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${referralLink}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Join Helvita Now
              </a>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; text-align: center;">
              Or copy this link: <br>
              <a href="${referralLink}" style="color: #4F46E5;">${referralLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              This email was sent by ${senderName} via Helvita. 
              If you don't want to receive these emails, simply ignore this message.
            </p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ email, success: true });
        
        // Save to user's sentReferrals (avoid duplicates)
        const existingReferral = user.sentReferrals?.find(r => r.email === email);
        if (!existingReferral) {
          if (!user.sentReferrals) user.sentReferrals = [];
          user.sentReferrals.push({
            email: email,
            name: email.split('@')[0], // Use email prefix as name initially
            sentAt: new Date(),
            status: 'Pending'
          });
        }
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err.message);
        results.push({ email, success: false, error: err.message });
      }
    }

    // Save user with updated sentReferrals
    await user.save();

    const successCount = results.filter(r => r.success).length;
    res.json({ 
      message: `Invites sent to ${successCount} email(s)`,
      results 
    });
  } catch (error) {
    console.error('Error sending referral invites:', error);
    res.status(500).json({ error: 'Failed to send invites' });
  }
};

// Send support message
const sendSupportMessage = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userEmail = user.email;
    const userName = user.cardHolderName || user.email.split('@')[0];
    const transporter = createTransporter();
    
    // Support email - you can change this to your actual support email
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;

    const mailOptions = {
      from: `"${userName}" <${process.env.EMAIL_USER}>`,
      replyTo: userEmail,
      to: supportEmail,
      subject: `Support Request from ${userName}: ${subject || 'General Inquiry'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px; padding: 20px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0;">New Support Request</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Helvita Customer Support</p>
          </div>
          
          <div style="background: #F3F4F6; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${userName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>
            <p style="margin: 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1F2937;">Message:</h3>
            <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          
          <p style="color: #6B7280; font-size: 12px; text-align: center;">
            Reply directly to this email to respond to the customer.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Support message sent successfully' });
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Send notification
const sendNotification = async (req, res) => {
  const { to, subject, message } = req.body;

  const transporter = createTransporter();

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
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

module.exports = {
  sendSupportMessage,
  sendNotification,
  sendReferralInvites,
};