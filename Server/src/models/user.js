import mongoose from 'mongoose';

const User = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    fullName: { type: String, required: true},
    bio: { type: String, default: ''},
    profilePicture: { type: String, default: ''},
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER'},
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: []}],
    following: [{type: mongoose.Schema.Types.ObjectId, ref: 'User', default: []}],
    savedBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: []}],
    savedAuthors: [{type: mongoose.Schema.Types.ObjectId, ref: 'User', default: []}],
    usersBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: []}],
    email: { type: String, required: true, unique: true},
    password: { type: String, required: true},
    lastLogin: { type: Date, default: Date.now,}
}, { timestamps: true });

export default mongoose.model("User", User);