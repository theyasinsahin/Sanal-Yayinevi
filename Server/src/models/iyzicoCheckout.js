import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantReference: { type: String, unique: true, required: true },
  token: String,
  checkoutUrl: String,
  amountMinor: { type: Number, required: true },
  currency: { type: String, default: 'TRY' },
  state: { type: String, default: 'PENDING' },
  leaseUntil: Date,
  cancelled: { type: Boolean, default: false },
  paymentId: String,
  paymentTransactionId: String,
  capturedAt: Date,
  refundReference: String,
  refundId: String,
}, { timestamps: true });
schema.index({ token: 1 }, { unique: true, partialFilterExpression: { token: { $type: 'string' } } });
export default mongoose.model('IyzicoCheckout', schema);
