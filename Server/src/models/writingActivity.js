import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  weekStart: { type: Date, required: true },
  words: { type: Number, default: 0, min: 0 },
});
schema.index({ userId: 1, chapterId: 1, weekStart: 1 }, { unique: true });
export default mongoose.model('WritingActivity', schema);
