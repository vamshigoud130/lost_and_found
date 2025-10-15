const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: { type: String, enum: ['Item', 'Match', 'User', 'Setting'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);


