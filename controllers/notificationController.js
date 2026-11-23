const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const user = req.user;
    let notifications = [];

    if (user.role === 'student') {
      notifications = await Notification.find({ recipient: user._id }).populate('leave');
    } else if (user.role === 'warden') {
      notifications = await Notification.find({ type: 'parent-approved' }).populate('leave');
    } else {
      // fallback: get notifications for the user
      notifications = await Notification.find({ recipient: user._id }).populate('leave');
    }

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark a notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    console.log('[deleteNotification] Attempting to delete notification:', req.params.id);

    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      console.log('[deleteNotification] Notification document does not exist');
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
