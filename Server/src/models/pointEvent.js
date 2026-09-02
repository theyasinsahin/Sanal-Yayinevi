// src/models/pointEvent.js
import mongoose from 'mongoose';

const PointEventSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  points: { type: Number, required: true },
  action: { type: String, required: true },
}, { timestamps: true }); // createdAt otomatik — tarih filtresi burada

// Liderboard sorgusu için compound index
PointEventSchema.index({ createdAt: -1, userId: 1 });

export default mongoose.model('PointEvent', PointEventSchema);