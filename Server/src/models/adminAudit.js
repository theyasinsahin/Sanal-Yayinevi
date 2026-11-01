import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource: { type: String, required: true },
  recordId: { type: String, required: true },
  action: { type: String, required: true },
  reason: { type: String, required: true, maxlength: 500 },
  fields: [String],
}, { timestamps: true });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ resource: 1, recordId: 1, createdAt: -1 });
export default mongoose.model('AdminAudit', schema);
