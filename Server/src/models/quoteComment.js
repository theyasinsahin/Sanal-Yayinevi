import mongoose from 'mongoose';

const QuoteCommentSchema = new mongoose.Schema({
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
}, { timestamps: true });

export default mongoose.model('QuoteComment', QuoteCommentSchema);