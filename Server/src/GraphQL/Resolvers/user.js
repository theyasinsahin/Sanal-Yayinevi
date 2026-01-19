import * as UserService from '../../services/userService.js';
import * as BookService from '../../services/bookService.js';
import * as TransactionService from '../../services/transactionService.js';
import { authenticateUser } from '../../utils/auth.js';

export default {
  // ANA SORGULAR
  Query: {
    getUserById: async (_, { id }) => UserService.findUserById(id),
    
    getUserByUsername: async (_, { username }) => UserService.findUserByUsername(username),
    
    getUserByEmail: async (_, { email }) => UserService.findUserByEmail(email),
    
    getAllUsers: async () => UserService.getAllUsers(),

    me: async (_, __, { req, User }) => { // User modelini context'ten veya service'den alabilirsin
      const user = await authenticateUser(req, User);
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
    register: async (_, args) => {
        try {
            return await UserService.registerUser(args);
        } catch (e) {
            return { code: 400, message: e.message };
        }
    },

    login: async (_, { email, password }) => {
        return UserService.loginUser(email, password);
    },

    toggleFollowUser: async (_, { followId }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");
        
        if (user._id.toString() === followId) throw new Error("Kendinizi takip edemezsiniz.");

        return UserService.toggleFollow(user._id, followId);
    },

    toggleSaveBook: async (_, { bookId }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");

        return UserService.toggleSaveBook(user._id, bookId);
    },

    updateProfile: async (_, args, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");

        // Basit güncelleme olduğu için direkt model kullanabilir veya
        // Service'e updateProfile metodu ekleyebilirsin.
        Object.assign(user, args); // Gelen alanları user objesine aktar
        return await user.save();
    },
    
    // deleteUserById çok karmaşık (diğer tablolardan silme vs.),
    // Onu UserService'e taşıyıp buradan tek satırla çağırabilirsin.
    deleteUserById: async (_, { id }, { req, User }) => {
         // ... Auth check ...
         // return UserService.deleteUserCompletely(id);
         return { code: 200, message: "Bu fonksiyon service'e taşınmalı." };
    }
},

  // ALAN ÇÖZÜCÜLER (Field Resolvers)
  // Bir User çekildiğinde, onun içindeki ilişkisel veriler istendiğinde burası çalışır.
  User: {
    // 1. usersBooks: Kullanıcının yazdığı kitaplar
    usersBooks: async (parent) => {
       // Service'e ID array'ini gönderiyoruz
       return await BookService.findBooksByIds(parent.usersBooks);
    },

    // 2. savedBooks: Kullanıcının kaydettiği kitaplar
    savedBooks: async (parent) => {
       return await BookService.findBooksByIds(parent.savedBooks);
    },
    
    // 3. followers: Takipçiler
    followers: async (parent) => {
       return await UserService.findUsersByIds(parent.followers);
    },

    // 4. following: Takip edilenler
    following: async (parent) => {
       return await UserService.findUsersByIds(parent.following);
    },

    // 5. donations: Bağış Geçmişi
    donations: async (parent) => {
        return await TransactionService.findTransactionsByUserId(parent._id);
    }
  }
};