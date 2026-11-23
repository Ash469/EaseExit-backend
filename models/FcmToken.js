const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // <-- add this line
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  role: { type: String, required: true },
  gender: String,
  deviceType: String,
  deviceId: String,
}, { timestamps: true });

module.exports = mongoose.model('FcmToken', fcmTokenSchema);