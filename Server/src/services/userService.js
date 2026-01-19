import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Book from '../models/book.js';

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username });
};

export const getAllUsers = async () => {
  return await User.find();
};

// Takipçi/Takip edilen işlemleri için helper
export const getUserWithFollowing = async (id) => {
  return await User.findById(id).populate('following');
};

export const getUserWithFollowers = async (id) => {
  return await User.findById(id).populate('followers');
};

// REGISTER
export const registerUser = async ({ username, fullName, email, password }) => {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) throw new Error('Bu email zaten kayıtlı.');

    const existingUsername = await User.findOne({ username });
    if (existingUsername) throw new Error('Bu kullanıcı adı alınmış.');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, fullName, email, password: hashedPassword });
    await user.save();

    return { code: 200, message: 'Kayıt başarılı' };
};

// LOGIN
export const loginUser = async (email, password) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Kullanıcı bulunamadı");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Hatalı şifre");

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return { token, user };
};

// TOGGLE FOLLOW
export const toggleFollow = async (currentUserId, targetUserId) => {
    const user = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (user.following.includes(targetUserId)) {
        // Unfollow
        user.following.pull(targetUserId);
        targetUser.followers.pull(currentUserId);
        await user.save();
        await targetUser.save();
        return { code: 200, message: "Takip bırakıldı" };
    } else {
        // Follow
        user.following.push(targetUserId);
        targetUser.followers.push(currentUserId);
        await user.save();
        await targetUser.save();
        return { code: 200, message: "Takip edildi" };
    }
};

// TOGGLE SAVE BOOK
export const toggleSaveBook = async (userId, bookId) => {
    const user = await User.findById(userId);
    if (user.savedBooks.includes(bookId)) {
        await User.findByIdAndUpdate(userId, { $pull: { savedBooks: bookId } });
    } else {
        await User.findByIdAndUpdate(userId, { $addToSet: { savedBooks: bookId } });
    }
    return await User.findById(userId);
};

export const getSavedBooksByUserId = async (userId) => {
    const user = await User.findById(userId).populate('savedBooks');
    return user.savedBooks;
};

export const getUsersBooksByUserId = async (userId) => {
    const user = await User.findById(userId).populate('usersBooks');
    return user.usersBooks;
};

export const findUsersByIds = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];

    return await User.find({ _id: { $in: userIds } });
};