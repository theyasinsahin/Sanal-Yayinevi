import * as UserService from '../../services/userService.js';
import * as BookService from '../../services/bookService.js';
import * as TransactionService from '../../services/transactionService.js';
import { authenticateUser } from '../../utils/auth.js';

export default {
  // ANA SORGULAR
  Query: {
    getUserById: async (_, { id }, context) => UserService.findUserById(id),
    
    getUserByUsername: async (_, { username }) => UserService.findUserByUsername(username),
    
    getUserByEmail: async (_, { email }) => UserService.findUserByEmail(email),
    
    getAllUsers: async () => UserService.getAllUsers(),

    me: async (_, __, { user }) => { // User modelini context'ten veya service'den alabilirsin
      if (!user) throw new Error("Giriş yapmalısınız.");
      return user;
    },
    
    // Bu sorgulara gerek kalmayabilir (User tipi içinde çözüyoruz) ama kalsın
    getFollowingByUserId: async (_, { id }) => {
       const user = await UserService.getUserWithFollowing(id);
       return user.following;
    },
    
    getFollowersByUserId: async (_, { id }) => {
       const user = await UserService.getUserWithFollowers(id);
       return user.followers;
    }
  },

  Mutation: {

    forgotPassword: async (_, { email }) => {
      return UserService.forgotPassword(email);
    },

    resetPassword: async (_, { token, newPassword }) => {
      return UserService.resetPassword(token, newPassword);
    },

    googleAuth: async (_, { token }) => {
        return await UserService.googleAuth(token);
    },

    sendRegistrationCode: async (_, { email, username, }) => {
        try {
            return await UserService.sendRegistrationCode(email, username);
        } catch (e) {
            console.error("SEND CODE ERROR =>", e); // <--- SERVER'DA GÖRMEK İÇİN BUNU EKLE
            return { code: 400, message: e.message };
        }
    },

    register: async (_, args) => {
        try {
            return await UserService.registerUser(args);
        } catch (e) {
            console.error("REGISTER ERROR =>", e); // <--- SERVER'DA GÖRMEK İÇİN BUNU EKLE
            return { code: 400, message: e.message };
        }
    },

    login: async (_, { email, password }) => {
        return UserService.loginUser(email, password);
    },

    toggleFollowUser: async (_, { followId }, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");
        
        if (user._id.toString() === followId) throw new Error("Kendinizi takip edemezsiniz.");

        return UserService.toggleFollow(user._id, followId);
    },

    toggleSaveBook: async (_, { bookId }, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");

        return UserService.toggleSaveBook(user._id, bookId);
    },

    updateProfile: async (_, args, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");

        // Basit güncelleme olduğu için direkt model kullanabilir veya
        // Service'e updateProfile metodu ekleyebilirsin.
        Object.assign(user, args); // Gelen alanları user objesine aktar
        return await user.save();
    },
    
    deleteUserById: async (_, { id }) => {
         //return UserService.deleteUserCompletely(id);
         return { code: 200, message: "Bu fonksiyon service'e taşınmalı." };
    },

    // ── Hesap ───────────────────────────────────────────────
    changeEmail: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.changeEmail(user._id, args);
    },
 
    changePassword: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.changePassword(user._id, args);
    },

    // ── Ayarlar ─────────────────────────────────────────────
    updatePrivacySettings: async (_, { privacySettings }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.updatePrivacySettings(user._id, privacySettings);
    },
 
    updateNotificationSettings: async (_, { notificationSettings }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.updateNotificationSettings(user._id, notificationSettings);
    },
 
    updateAuthorSettings: async (_, { authorSettings }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.updateAuthorSettings(user._id, authorSettings);
    },

    // ── Hesap Yönetimi ──────────────────────────────────────
    deactivateAccount: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.deactivateAccount(user._id);
    },
 
    deleteAccount: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return UserService.deleteAccountCompletely(user._id);
    },
},

  // ALAN ÇÖZÜCÜLER (Field Resolvers)
  // Bir User çekildiğinde, onun içindeki ilişkisel veriler istendiğinde burası çalışır.
  User: {
  // isOwner kontrolü: parent._id ile query yapan kullanıcı aynı mı?
  // Context'ten currentUserId gelmeli — yoksa basit authorId sorgusu yap
  usersBooks: async (parent, _, context) => {
    return await BookService.findBooksByAuthorId(parent._id);
  },

  savedBooks: async (parent) => {
    return await BookService.findBooksByIds(parent.savedBooks);
  },

  followers: async (parent) => {
    return await UserService.findUsersByIds(parent.followers);
  },

  following: async (parent) => {
    return await UserService.findUsersByIds(parent.following);
  },

  donations: async (parent) => {
    return await TransactionService.findTransactionsByUserId(parent._id);
  },

  // Ayar alanları — başka kullanıcının profilinde null dön
    privacySettings: (parent, _, { user }) => {
      if (!user || user._id.toString() !== parent._id.toString()) return null;
      return parent.privacySettings;
    },
 
    notificationSettings: (parent, _, { user }) => {
      if (!user || user._id.toString() !== parent._id.toString()) return null;
      return parent.notificationSettings;
    },
 
    authorSettings: (parent, _, { user }) => {
      if (!user || user._id.toString() !== parent._id.toString()) return null;
      return parent.authorSettings;
    },
},
};