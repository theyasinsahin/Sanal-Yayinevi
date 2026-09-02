// src/models/badge.js
import mongoose from 'mongoose';

const BadgeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // örn: 'first_quote'
  name: { type: String, required: true },              // örn: 'İlk Alıntı'
  description: { type: String, required: true },
  icon: { type: String, default: '🏅' },
  condition: {
    stat: { type: String, required: true }, // örn: 'quotesCreated'
    threshold: { type: Number, required: true }, // örn: 1
  }
}, { timestamps: true });

export default mongoose.model('Badge', BadgeSchema);