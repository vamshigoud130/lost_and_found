const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['lost', 'found'], required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    imageBase64: { type: String },
    isResolved: { type: Boolean, default: false },
    moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    moderationNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

itemSchema.index({ name: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('Item', itemSchema);


