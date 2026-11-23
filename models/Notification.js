const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'leave-status-changed',      // Student: any status change (legacy/general)
      'leave-request',             // Parent: ward made a leave request
      'parent-approved',           // Student: parent approved leave
      'parent-rejected',           // Student: parent rejected leave
      'warden-approved',           // Student: warden approved leave
      'warden-rejected',           // Student: warden rejected leave
      'guard-approved',            // Student/Parent: guard approved
      'guard-rejected',            // Student: guard rejected
      'guard-return',              // Parent: guard marked return
      'student-return',             // Student: guard marked return
      'concern-registered'          // Student: concern registered
    ],
    required: true
  },
  message: { type: String, required: true },
  leave: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveApplication'
  },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
