const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'general' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    meta: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);


