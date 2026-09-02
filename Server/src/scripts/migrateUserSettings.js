// scripts/migrateUserSettings.js
// ─────────────────────────────────────────────────────────────────
// Mevcut kullanıcılara varsayılan ayar alanlarını ekler.
// Tek seferlik çalıştır: node scripts/migrateUserSettings.js
// ─────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';
import dotenv   from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB bağlandı.');

const db = mongoose.connection.db;
const col = db.collection('users');

const defaultPrivacy = {
  isProfilePublic:    true,
  isLibraryPublic:    true,
  isFollowListPublic: true,
  allowMessages:      'everyone',
  showInSearchEngines:true,
};

const defaultNotifications = {
  newFollower:      true,
  mentionInSession: true,
  bookComment:      true,
  bookLike:         true,
  quoteLike:        true,
  sessionReply:     true,
  publishingOffer:  true,
  offerUpdate:      true,
  emailDigest:      false,
  emailOffers:      true,
  emailMarketing:   false,
};

const defaultAuthor = {
  defaultLanguage:   'tr',
  publishingVisible: true,
  copyrightNote:     '',
  weeklyWordGoal:    null,
  preferredGenres:   [],
};

// Yalnızca bu alanlar eksik olan kullanıcıları güncelle
const result = await col.updateMany(
  { privacySettings: { $exists: false } },
  {
    $set: {
      privacySettings:      defaultPrivacy,
      notificationSettings: defaultNotifications,
      authorSettings:       defaultAuthor,
      isActive:             true,
    },
  }
);

console.log(`Güncellenen kullanıcı sayısı: ${result.modifiedCount}`);
await mongoose.disconnect();
console.log('Migrasyon tamamlandı.');