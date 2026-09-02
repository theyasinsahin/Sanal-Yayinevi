// src/models/userScore.js
import mongoose from 'mongoose';

const UserScoreSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  totalPoints: { type: Number, default: 0 },
  
  // Aksiyon sayaçları (badge kontrolü için)
  stats: {
    quotesCreated:   { type: Number, default: 0 },
    commentsCreated: { type: Number, default: 0 },
    repostsCreated:  { type: Number, default: 0 },
    booksPublished:  { type: Number, default: 0 },
    chaptersAdded:   { type: Number, default: 0 },
    minutesRead:     { type: Number, default: 0 },
  },

}, { timestamps: true });

export default mongoose.model('UserScore', UserScoreSchema);