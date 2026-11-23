const admin = require('firebase-admin');
const FcmToken = require('../models/FcmToken');
const Notification = require('../models/Notification');

exports.sendFcmToUser = async (userId, title, body, data = {}, notificationType = null, leaveId = null) => {
  // Save notification in DB if type is provided (always, even if no tokens)
  if (notificationType) {
    await Notification.create({
      recipient: userId,
      type: notificationType,
      message: body,
      leave: leaveId || undefined,
    });
  }

  // Find all FCM tokens for the user
  const tokens = await FcmToken.find({ userId }).distinct('token');
  if (!tokens.length) {
    console.log(`→ No FCM tokens found for user ${userId}. Notification "${title}" not sent.`);
    return;
  }

  // Prepare the message payload
  const payload = {
    notification: {
      title,
      body,
      image: "https://tse4.mm.bing.net/th/id/OIP.SrR9s6XqoARCHLrQ6F4tHQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3", // Replace with a publicly accessible URL
    },
    data: {
      ...data,
      click_action: "FLUTTER_NOTIFICATION_CLICK", 
    },
  };

  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        ...payload,
      });
      console.log(`→ FCM notification sent to user ${userId}: "${title}" - ${body} [Token: ${token}]`);
    } catch (error) {
      console.error(`→ Failed to send notification to token ${token}:`, error);
    }
  }
};
