const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markNotificationRead,
  deleteNotification
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

// Get all notifications for the logged-in user
router.get('/', getNotifications);

// Mark a notification as read
router.patch('/:id/read', markNotificationRead);

// Delete a notification
router.delete('/:id', deleteNotification);

module.exports = router;
