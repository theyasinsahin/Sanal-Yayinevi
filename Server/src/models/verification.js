import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
    email: { type: String, required: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // 600 saniye = 10 dk
});

export default mongoose.model('Verification', verificationSchema);