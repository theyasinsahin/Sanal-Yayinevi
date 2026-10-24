import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'active', 'unsubscribed'], default: 'pending' },
  consentVersion: { type: String, default: '2026-10-23' },
  requestedAt: Date,
  confirmedAt: Date,
  unsubscribedAt: Date,
  tokenHash: String,
  tokenExpiresAt: Date,
}, { timestamps: true });

export default mongoose.model('NewsletterSubscription', schema);
