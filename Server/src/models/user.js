import mongoose from 'mongoose';

const User = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    fullName: {
        type: String,
        required: true,
    },
    bio: {
        type: String,
        default: '',
    },
    profilePicture: {
        type: String,
        default: '',
    },
    role: {
        type: String,
        enum: ['USER', 'ADMIN'],
        default: 'USER',
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    favouriteBooks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
    }],
    favouriteAuthors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Author',
    }],
    usersBooks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
    }],
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    }
});

export default mongoose.model("User", User);