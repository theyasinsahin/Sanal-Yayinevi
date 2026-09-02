// src/models/message.js
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    default: '', 
  },
  type: {
    type: String,
    enum: ['TEXT', 'QUOTE', 'BOOK'],
    default: 'TEXT',
  },
  attachedQuoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    default: null,
  },
  attachedBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    default: null,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  // Not: Bu alan öncesinde yoktu; isDeleted zaten doğru şekilde
  // kullanılıyordu (hard-delete yoktu), sadece deletedAt eksikti.
  // Diğer tüm modellerle tutarlılık için eklendi.
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Konuşma bazlı mesaj sorgularını hızlandır
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model('Message', MessageSchema);