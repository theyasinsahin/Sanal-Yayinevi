import mongoose from 'mongoose';

// A shared write serializes role/account changes to prevent last-admin write skew.
const schema = new mongoose.Schema({ _id: String, version: { type: Number, default: 0 } });
export default mongoose.model('AdminControl', schema);
