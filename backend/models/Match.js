const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    itemAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    itemBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'resolved'], default: 'pending' },
    notes: { type: String, trim: true },
    adminNotes: { type: String, trim: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    messages: [
      {
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        body: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
  },
  { timestamps: true }
);

matchSchema.index({ itemAId: 1, itemBId: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);


