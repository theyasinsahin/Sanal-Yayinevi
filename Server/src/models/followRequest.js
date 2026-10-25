import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'], default: 'PENDING', required: true },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ requesterId: 1, recipientId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });
schema.index({ recipientId: 1, status: 1, createdAt: -1 });
export default mongoose.model('FollowRequest', schema);
