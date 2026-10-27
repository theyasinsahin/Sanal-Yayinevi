import * as UserService from '../../services/userService.js';
import * as BookService from '../../services/bookService.js';
import * as TransactionService from '../../services/transactionService.js';
import { canViewProfile, canViewLibrary, canViewFollowList, sameUser, canReceiveMessage } from '../../utils/profileAccess.js';
import { weeklyWords } from '../../services/writingService.js';
import { getAdminRecord, saveAdminRecord } from '../../services/adminService.js';

async function profileFor(parent, context) {
  context.profileAccessCache ??= new Map();
  const id = String(parent._id ?? parent.id);
  if (!context.profileAccessCache.has(id)) context.profileAccessCache.set(id, UserService.findUserById(id));
  return context.profileAccessCache.get(id);
}

export default {
  // ANA SORGULAR
  Query: {
    getUserById: async (_, { id }) => UserService.findUserById(id),
    
    getUserByUsername: async (_, { username }) => UserService.findUserByUsername(username),
    
    getUserByEmail: async (_, { email }, { user }) => user && (user.email === email || user.role === 'ADMIN') ? UserService.findUserByEmail(email) : null,
    
    getAllUsers: async () => UserService.getAllUsers(),

    me: async (_, __, { user }) => { // User modelini context'ten veya service'den alabilirsin
      if (!user) throw new Error("Giriş yapmalısınız.");
      return user;
    },
    
    // Bu sorgulara gerek kalmayabilir (User tipi içinde çözüyoruz) ama kalsın
    getFollowingByUserId: async (_, { id }, { user }) => {
      const profile = await UserService.findUserById(id);
      return canViewFollowList(profile, user) ? UserService.findUsersByIds(profile.following) : [];
    },
    
    getFollowersByUserId: async (_, { id }, { user }) => {
      const profile = await UserService.findUserById(id);
      return canViewFollowList(profile, user) ? UserService.findUsersByIds(profile.followers) : [];
    },
    getSavedBooksByUserId: async (_, { id }, { user }) => {
      const profile = await UserService.findUserById(id);
      return canViewLibrary(profile, user) ? UserService.getSavedBooksByUserId(id) : [];
    },
    getUsersBooksByUserId: async (_, { id }, { user }) => {
      const profile = await UserService.findUserById(id);
      if (!canViewProfile(profile, user)) return [];
      const books = await BookService.findBooksByAuthorId(id);
      return sameUser(profile, user) || user?.role === 'ADMIN' ? books : books.filter(book => book.status !== 'DRAFT');
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
    
    deleteUserById: async (_, { id }, context) => {
         const record = await getAdminRecord(context, { resource: 'User', id });
         if (!record) throw new Error('Kullanıcı bulunamadı.');
         await saveAdminRecord(context, { resource: 'User', id, revision: record.revision, changes: { isActive: false }, reason: 'Kullanıcı yönetimi üzerinden hesap devre dışı bırakıldı.' });
         return { code: 200, message: 'Hesap devre dışı bırakıldı. Kullanıcı verileri korundu.' };
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
  canViewProfile: async (profile, _, context) => canViewProfile(await profileFor(profile, context), context.user),
  canViewLibrary: async (profile, _, context) => canViewLibrary(await profileFor(profile, context), context.user),
  canViewFollowList: async (profile, _, context) => canViewFollowList(await profileFor(profile, context), context.user),
  canMessage: async (profile, _, context) => Boolean(context.user && canReceiveMessage(await profileFor(profile, context), context.user._id)),
  isSearchIndexable: async (profile, _, context) => {
    const full = await profileFor(profile, context);
    return Boolean(full && full.privacySettings?.isProfilePublic !== false && full.privacySettings?.showInSearchEngines !== false);
  },
  weeklyWritingWords: (profile, _, { user }) => sameUser(profile, user) ? weeklyWords(profile._id) : null,
  email: (profile, _, { user }) => sameUser(profile, user) || user?.role === 'ADMIN' ? profile.email : '',
  bio: async (profile, _, context) => {
    const full = await profileFor(profile, context);
    return canViewProfile(full, context.user) ? full.bio || '' : '';
  },
  // isOwner kontrolü: parent._id ile query yapan kullanıcı aynı mı?
  // Context'ten currentUserId gelmeli — yoksa basit authorId sorgusu yap
  usersBooks: async (parent, _, context) => {
    if (!canViewProfile(await profileFor(parent, context), context.user)) return [];
    const books = await BookService.findBooksByAuthorId(parent._id);
    return sameUser(parent, context.user) || context.user?.role === 'ADMIN' ? books : books.filter(book => book.status !== 'DRAFT');
  },

  savedBooks: async (parent, _, context) => {
    if (!canViewLibrary(await profileFor(parent, context), context.user)) return [];
    return await BookService.findBooksByIds(parent.savedBooks);
  },

  followers: async (parent, _, context) => {
    if (!canViewFollowList(await profileFor(parent, context), context.user)) return [];
    return await UserService.findUsersByIds(parent.followers);
  },

  following: async (parent, _, context) => {
    if (!canViewFollowList(await profileFor(parent, context), context.user)) return [];
    return await UserService.findUsersByIds(parent.following);
  },

  donations: async (parent, _, { user }) => {
    if (!sameUser(parent, user) && user?.role !== 'ADMIN') return [];
    return await TransactionService.findTransactionsByUserId(parent._id);
  },

  // Ayar alanları — başka kullanıcının profilinde null dön
    privacySettings: (parent, _, { user }) => {
      if (!sameUser(parent, user) && user?.role !== 'ADMIN') return null;
      return parent.privacySettings;
    },
 
    notificationSettings: (parent, _, { user }) => {
      if (!sameUser(parent, user) && user?.role !== 'ADMIN') return null;
      return parent.notificationSettings;
    },
 
    authorSettings: (parent, _, { user }) => {
      if (!sameUser(parent, user) && user?.role !== 'ADMIN') return null;
      return parent.authorSettings;
    },
},
};
