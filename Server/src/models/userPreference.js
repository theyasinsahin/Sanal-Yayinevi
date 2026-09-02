// src/models/userPreference.js
import mongoose from 'mongoose';

const UserPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  preferredGenres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    default: [],
  }],
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model('UserPreference', UserPreferenceSchema);