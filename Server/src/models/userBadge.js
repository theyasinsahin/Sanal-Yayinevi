// src/models/userBadge.js
import mongoose from 'mongoose';

const UserBadgeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
  earnedAt: { type: Date, default: Date.now },
}, { timestamps: true });

UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export default mongoose.model('UserBadge', UserBadgeSchema);