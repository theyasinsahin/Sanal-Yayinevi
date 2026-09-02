import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        default: ''
    },
    groupImageUrl: {
        type: String,
        default: ''
    }
}, { timestamps: true });

export default mongoose.model('Conversation', ConversationSchema);