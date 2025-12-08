const express = require('express');
const { sendSupportMessage, sendNotification } = require('../controllers/supportController');
const auth = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Send support message
router.post('/message', sendSupportMessage);

// Send notification (admin only?)
router.post('/notification', sendNotification);

module.exports = router;