import { authenticateUser } from "../../../utils/auth.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

export default {
    register: async (_, { username, fullName, email, password }, {User}) => {
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail) {
            return {
            code: 400,
            message: 'User already exists with this email',
            };
        }

        const existingUserByUsername = await User.findOne({ username });
        if (existingUserByUsername) {
            return {
            code: 400,
            message: 'User already exists with this username',
            };
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = new User({ username, fullName, email, password: hashedPassword });
            await user.save();

            return {
            code: 200,
            message: 'User registered successfully',
            };
        } catch (error) {
            console.error('Register error:', error);
            return {
            code: 500,
            message: 'Internal server error during registration',
            };
        }
    },

    login: async (_, { email, password }, {User}) => {
        const user = await User.findOne({ email });
        if (!user) throw new Error("User not found");

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new Error("Invalid credentials");

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        return {
            token,
            user
        };
    },
    deleteUserById: async (_, { id }, { User, Book, Comment, Chapter }) => {
        const user = await User.findById(id);
        if (!user) throw new Error("User not found");

        // 1. Kullanıcının kitaplarını bul
        const userBooks = await Book.find({ _id: { $in: user.userBooks } });

        // 2. Her kitap için ilgili yorum ve bölümleri sil
        for (const book of userBooks) {
            // Eğer kitaplarda comment/chapters dizisi varsa:
            if (book.comments && book.comments.length > 0) {
                await Comment.deleteMany({ _id: { $in: book.comments } });
            }

            if (book.chapters && book.chapters.length > 0) {
                await Chapter.deleteMany({ _id: { $in: book.chapters } });
            }
        }

        // 3. Kitapları sil
        await Book.deleteMany({ _id: { $in: user.userBooks } });

        // 4. Diğer kullanıcıların "followers" listesinden sil
        await User.updateMany({ followers: id }, { $pull: { followers: id } });

        // 5. Diğer kullanıcıların "following" listesinden sil
        await User.updateMany({ following: id }, { $pull: { following: id } });

        // 6. Kullanıcının kendisini sil
        await User.findByIdAndDelete(id);

        return { code: 200, message: "User deleted successfully" };
    },

    toggleFollowUser: async (_, { followId }, {req, User}) => {
       const user = await authenticateUser(req, User);

        const targetUser = await User.findById(followId);
        
        if (!user || !targetUser) {
            throw new Error("User not found");
        }

        // Kendini takip etmeyi engelle
        if (user._id.toString() === targetUser._id.toString()) {
            throw new Error("You cannot follow yourself");
        }
        
        // KONTROL: Zaten takip ediyor mu?
        const isFollowing = user.following.includes(followId);

        if (isFollowing) {
            // TAKİBİ BIRAK (Unfollow)
            user.following.pull(followId);
            targetUser.followers.pull(user._id);
            
            await user.save();
            await targetUser.save();

            return {
                code: 200,
                message: "User unfollowed successfully",
            };
        } else {
            // TAKİP ET (Follow)
            user.following.push(followId);
            targetUser.followers.push(user._id);

            await user.save();
            await targetUser.save();

            return {
                code: 200,
                message: "User followed successfully",
            };
        }
    },
    updateProfile: async (_, { username, fullName, bio, profilePicture }, { req, User }) => {
        const user = await authenticateUser(req, User);

        if (!user) {
            throw new Error("User not found");
        }

        if (username) user.username = username;
        if (fullName) user.fullName = fullName;
        if (bio) user.bio = bio;
        if (profilePicture) user.profilePicture = profilePicture;

        await user.save();
        
        return user;
    },
    toggleSaveBook: async (_, { bookId }, {req, User}) => {
        const user = await authenticateUser(req, User); 
      try {
        const currentUser = await User.findById(user.id);
        
        const isBookSaved = currentUser.savedBooks.includes(bookId);

        if (isBookSaved) {
          await User.findByIdAndUpdate(user.id, {
            $pull: { savedBooks: bookId } // DÜZELTME 2: Alan isminin doğruluğu
          });
        } else {
          await User.findByIdAndUpdate(user.id, {
            $addToSet: { savedBooks: bookId } 
          });
        }
        // Güncel kullanıcıyı döndür
        return await User.findById(user.id);
      } catch (err) {
        throw new Error(err);
      }
}
};