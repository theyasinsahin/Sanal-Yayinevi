// src/models/notification.js
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['POINTS_EARNED', 'BADGE_EARNED', 'FUNDING_RECEIVED', 'NEW_CHAPTER', 'BOOK_LIKED', 'COMMENT_RECEIVED'],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, default: '🏅' },
  isRead: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);