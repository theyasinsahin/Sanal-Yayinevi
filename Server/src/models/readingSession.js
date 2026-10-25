import mongoose from 'mongoose';

const ReadingSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  token: { type: String, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  lastHeartbeatAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  clockBudgetMs: { type: Number, default: 0 },
  sequence: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('ReadingSession', ReadingSessionSchema);
