// src/models/user.js
import mongoose from 'mongoose';

const PrivacySettingsSchema = new mongoose.Schema({
  isProfilePublic:     { type: Boolean, default: true },
  isLibraryPublic:     { type: Boolean, default: true },
  isFollowListPublic:  { type: Boolean, default: true },
  allowMessages:       { type: String, enum: ['everyone', 'followers', 'none'], default: 'everyone' },
  showInSearchEngines: { type: Boolean, default: true },
}, { _id: false });

const NotificationSettingsSchema = new mongoose.Schema({
  newFollower:      { type: Boolean, default: true },
  mentionInSession: { type: Boolean, default: true },
  bookComment:      { type: Boolean, default: true },
  bookLike:         { type: Boolean, default: true },
  quoteLike:        { type: Boolean, default: true },
  sessionReply:     { type: Boolean, default: true },
  publishingOffer:  { type: Boolean, default: true },
  offerUpdate:      { type: Boolean, default: true },
  emailDigest:      { type: Boolean, default: false },
  emailOffers:      { type: Boolean, default: true },
  emailMarketing:   { type: Boolean, default: false },
}, { _id: false });

const AuthorSettingsSchema = new mongoose.Schema({
  defaultLanguage:   { type: String, default: 'tr' },
  publishingVisible: { type: Boolean, default: true },
  copyrightNote:     { type: String, default: '', maxlength: 300 },
  weeklyWordGoal:    { type: Number, default: null, min: 0 },
  preferredGenres:   [{ type: String }],
}, { _id: false });

const User = new mongoose.Schema({
  username:       { type: String, required: true, unique: true },
  fullName:       { type: String, required: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  bio:            { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  website:        { type: String, default: '' },
  role:           { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  isVerified:     { type: Boolean, default: false },
  isActive:       { type: Boolean, default: true },

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted:  { type: Boolean, default: false },
  deletedAt:  { type: Date,    default: null  },

  followers:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  following:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  savedBooks:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: [] }],
  savedAuthors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  usersBooks:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: [] }],
  followedBooks:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: [] }],

  lastLogin:            { type: Date,   default: Date.now },
  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },
  isPremium:            { type: Boolean, default: false },

  privacySettings:      { type: PrivacySettingsSchema,      default: () => ({}) },
  notificationSettings: { type: NotificationSettingsSchema, default: () => ({}) },
  authorSettings:       { type: AuthorSettingsSchema,       default: () => ({}) },

}, { timestamps: true });

User.index({ isDeleted: 1 });

export default mongoose.model('User', User);