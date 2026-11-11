import { emailChangedEmail, passwordResetEmail, registrationEmail } from '../emails/templates.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { GraphQLError } from 'graphql';

import * as FollowService from './followService.js';
import Genre from '../models/genre.js';
import { saveUserPreference } from './recommendationService.js';
import Book from '../models/book.js';
import User from '../models/user.js';
import Quote from '../models/quote.js';
import Comment from '../models/comment.js';
import ParagraphComment from '../models/paragraphComment.js';
import QuoteComment from '../models/quoteComment.js';
import Message from '../models/message.js';

import Verification from '../models/verification.js'; // Yeni bir model gerekecek
import transporter from '../config/smtp.js';

import * as BookService from './bookService.js';
import * as SessionService from './sessionService.js';

import { validatePassword } from '../utils/passwordValidation.js';

import '../config/environment.js';


import { OAuth2Client } from 'google-auth-library';
import { paginate } from '../security/pagination.js';

const emailPattern = email => new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const tokenHash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizeEmail = email => {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@<>,;:"\\]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim())) throw new Error('Geçerli bir e-posta girin.');
  return email.trim().toLowerCase();
};
const checkUsername = username => {
  if (typeof username !== 'string' || !/^[\p{L}\p{N}_][\p{L}\p{N}_.-]{2,49}$/u.test(username)) throw new Error('Kullanıcı adı 3–50 harf, rakam, nokta, tire veya alt çizgiden oluşmalı.');
};
const resetResponse = () => ({ code: 200, message: 'Kayıtlı bir hesap varsa sıfırlama isteğiniz alındı. E-postanızı ve spam klasörünü kontrol edin; ulaşmazsa biraz sonra tekrar deneyin.' });
// Equal bcrypt work also for nonexistent/deleted accounts.
const dummyPasswordHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ── Hesap: E-posta Değiştirme ─────────────────────────────────────
export const changeEmail = async (userId, { newEmail, currentPassword }) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  newEmail = normalizeEmail(newEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 254) throw new Error('Geçerli bir e-posta girin.');
  if (user.email.toLowerCase() === newEmail) throw new Error('Yeni e-posta mevcut adresinizden farklı olmalı.');

  // Mevcut şifre doğrulaması
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error('Mevcut şifre hatalı.');

  // Yeni e-posta başka biri tarafından kullanılıyor mu?
  const taken = await User.findOne({ email: emailPattern(newEmail), _id: { $ne: userId } });
  if (taken) throw new Error('Bu e-posta adresi zaten kullanılıyor.');

  const previousEmail = user.email;
  user.email = newEmail;
  user.isVerified = false;
  user.authVersion = (user.authVersion ?? 0) + 1;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  // The account change already succeeded; SMTP failure must not report it as a failed mutation.
  try {
    const delivery = await transporter.sendMail({
      from: { name: 'Betik', address: process.env.EMAIL_USER }, to: newEmail, bcc: previousEmail, ...emailChangedEmail(),
    });
    if (!delivery.accepted?.length) throw new Error('E-posta kabul edilmedi.');
    return { code: 200, message: 'E-posta güncellendi. Bilgilendirme e-postası gönderildi.' };
  } catch {
    return { code: 200, message: 'E-posta güncellendi; bilgilendirme e-postası gönderilemedi.' };
  }
};

export const forgotPassword = async (email) => {
  email = normalizeEmail(email);
  const user = await User.findOne({ email: emailPattern(email), isDeleted: false, loginBlocked: { $ne: true } });
  // Güvenlik için kullanıcı bulunamasa da aynı mesajı dön
  if (!user) return resetResponse();

  // Güvenli random token üret
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

  // Token'ı DB'ye kaydet
  const previousReset = { resetPasswordToken: user.resetPasswordToken || null, resetPasswordExpires: user.resetPasswordExpires || null };
  user.resetPasswordToken = tokenHash(token);
  user.resetPasswordExpires = expires;
  await user.save();

  // Sıfırlama linki
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  try { await transporter.sendMail({
    from: { name: 'Betik', address: process.env.EMAIL_USER },
    to: email,
    ...passwordResetEmail({ resetUrl }),
  }); } catch {
    console.error('SECURITY_PASSWORD_RESET_DELIVERY_FAILED');
    // A failed resend must not invalidate a link already in the user's inbox.
    // Compare the new token so concurrent successful requests are never undone.
    try { await User.updateOne({ _id: user._id, resetPasswordToken: tokenHash(token) }, { $set: previousReset }); }
    catch { console.error('SECURITY_PASSWORD_RESET_ROLLBACK_FAILED'); }
  }

  return resetResponse();
};

// ── Hesap: Şifre Değiştirme ───────────────────────────────────────
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error('Mevcut şifre hatalı.');

  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  user.password = await bcrypt.hash(newPassword, 12);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.authVersion = (user.authVersion ?? 0) + 1;
  await user.save();

  return { code: 200, message: 'Şifre başarıyla değiştirildi.' };
};

// ── Ayarlar: Gizlilik ─────────────────────────────────────────────
export const updatePrivacySettings = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  user.privacySettings ??= {};
  Object.assign(user.privacySettings, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null)));
  user.markModified('privacySettings');
  return user.save();
};

// ── Ayarlar: Bildirimler ──────────────────────────────────────────
export const updateNotificationSettings = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  user.notificationSettings ??= {};
  Object.assign(user.notificationSettings, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null)));
  user.markModified('notificationSettings');
  return user.save();
};

// ── Ayarlar: Yazar Tercihleri ─────────────────────────────────────
export const updateAuthorSettings = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  if (input.copyrightNote && input.copyrightNote.length > 300) {
    throw new Error('Telif notu en fazla 300 karakter olabilir.');
  }

  if (input.weeklyWordGoal != null && (!Number.isSafeInteger(input.weeklyWordGoal) || input.weeklyWordGoal < 0)) {
    throw new Error('Kelime hedefi sıfır veya pozitif bir tam sayı olmalı.');
  }
  if (input.preferredGenres) {
    const genres = await Genre.find({ name: { $in: input.preferredGenres }, isActive: true, classificationVersion: 1 });
    if (genres.length !== new Set(input.preferredGenres).size) throw new Error('Geçersiz kitap türü.');
    await saveUserPreference(userId, genres.map(genre => genre._id));
  }
  user.authorSettings ??= {};
  const { copyrightNote, weeklyWordGoal, preferredGenres } = input;
  if (copyrightNote != null) user.authorSettings.copyrightNote = copyrightNote;
  if ('weeklyWordGoal' in input) user.authorSettings.weeklyWordGoal = weeklyWordGoal;
  if (preferredGenres != null) user.authorSettings.preferredGenres = preferredGenres;
  user.markModified('authorSettings');
  return user.save();
};

// ── Hesap Yönetimi: Devre Dışı Bırakma ───────────────────────────
// Not: Bu, isDeleted'ten AYRI bir durum. Kullanıcı istediği zaman
// tekrar giriş yaparak hesabını aktive edebilir (mevcut akış korunuyor).
export const deactivateAccount = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  user.isActive = false;
  user.authVersion = (user.authVersion ?? 0) + 1;
  await user.save();

  return { code: 200, message: 'Hesabınız devre dışı bırakıldı.' };
};

// ── Hesap Yönetimi: Hesabı Silme (SOFT DELETE) ───────────────────
// Projedeki hiçbir silme işlemi hard-delete olmadığı için bu fonksiyon
// hiçbir dökümanı veritabanından gerçekten silmiyor. Sırasıyla:
//   1) Kullanıcının kitaplarını BookService.softDeleteBook ile soft-delete
//      eder (bu da otomatik olarak o kitapların chapter/comment/quote'larını
//      cascade soft-delete eder ve diğer kullanıcıların
//      savedBooks/usersBooks/followedBooks listelerinden çıkarır).
//   2) Kullanıcının kendi yazdığı alıntıları (Quote) soft-delete eder
//      (başkasının kitabına yazdığı alıntılar dahil).
//   3) Kullanıcının açtığı okuma oturumlarını (Session) ve o oturumlara
//      yazdığı SessionEntry'leri soft-delete eder.
//   4) Kullanıcının kendisini isDeleted:true, deletedAt:now ve
//      isActive:false olarak işaretler.
//   5) Diğer kullanıcıların followers/following listelerinden bu
//      kullanıcının referansını çıkarır (ilişki listesi temizliği —
//      hiçbir dökümanı silmez).
//
// NOT (düzeltilen buglar): Önceki kod `Book.find({ author: objectId })`
// ve `Quote.deleteMany({ user: objectId })` kullanıyordu; gerçek alan
// adları `authorId` ve `userId`. Ayrıca `Session.deleteMany({ book: {...} })`
// çağrısı hiçbir işe yaramıyordu çünkü Session şemasında hiç `book` alanı
// yok — Session'lar bir kitaba değil `createdBy` ile doğrudan kullanıcıya
// bağlı. Bu sürümde doğru alan adları ve doğru ilişki kullanılıyor.
export const deleteAccountCompletely = async (userId) => {
  const objectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  // 1) Kullanıcının kitaplarını soft-delete et (chapter/comment/quote cascade'i dahil)
  const userBooks = await Book.find({ authorId: objectId, isDeleted: false }).select('_id');
  for (const book of userBooks) {
    await BookService.softDeleteBook(book._id);
  }

  // 2) Kullanıcının kendi yazdığı alıntıları soft-delete et
  await Quote.updateMany(
    { userId: objectId, isDeleted: false },
    { isDeleted: true, deletedAt: now }
  );

  // 3) Kullanıcının açtığı oturumları ve oturum girdilerini soft-delete et
  await SessionService.softDeleteSessionsByUserId(objectId);
  await SessionService.softDeleteSessionEntriesByUserId(objectId);

  await Promise.all([
    Comment.updateMany({ userId: objectId }, { isDeleted: true, deletedAt: now }),
    ParagraphComment.updateMany({ userId: objectId }, { isDeleted: true, deletedAt: now }),
    QuoteComment.updateMany({ userId: objectId }, { isDeleted: true, deletedAt: now }),
    Message.updateMany({ senderId: objectId }, { isDeleted: true, deletedAt: now }),
  ]);

  // 4) Diğer kullanıcılardan bu kişiyi takipçi/takip listesinden çıkar
  await User.updateMany(
    { $or: [{ followers: objectId }, { following: objectId }] },
    { $pull: { followers: objectId, following: objectId } },
  );

  // 5) Kullanıcıyı SOFT-DELETE et
  await User.findByIdAndUpdate(objectId, {
    isDeleted: true,
    deletedAt: now,
    isActive: false,
  });

  return { code: 200, message: 'Hesabınız silindi.' };
};

export const resetPassword = async (token, newPassword) => {
  // Token'ı DB'de ara, süresi dolmamış olmalı
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new GraphQLError(passwordError, { extensions: { code: 'BAD_USER_INPUT' } });

  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new GraphQLError('Geçersiz veya süresi dolmuş bağlantı.', { extensions: { code: 'BAD_USER_INPUT' } });
  const hashed = await bcrypt.hash(newPassword, 12);
  // One conditional write consumes the token and revokes every earlier session.
  const changed = await User.updateOne({ resetPasswordToken: tokenHash(token), resetPasswordExpires: { $gt: new Date() }, isDeleted: false, loginBlocked: { $ne: true } }, {
    $set: { password: hashed, resetPasswordToken: null, resetPasswordExpires: null }, $inc: { authVersion: 1 },
  });
  if (!changed.modifiedCount) throw new GraphQLError('Geçersiz veya süresi dolmuş bağlantı.', { extensions: { code: 'BAD_USER_INPUT' } });

  return { code: 200, message: 'Şifreniz başarıyla güncellendi.' };
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Google credential doğrulama — ORTAK ÇEKİRDEK ─────────────────
// Hem GraphQL mutation'ı (googleAuth, popup akışı için) hem de
// REST /auth/google/callback route'u (redirect akışı için) bu
// fonksiyonu kullanır. Böylece iki farklı giriş noktasında Google
// doğrulama/kullanıcı oluşturma mantığı birbirinden sapmaz.
export const authenticateWithGoogleCredential = async (idToken, { requireNonce = false } = {}) => {
  // 1. Google'dan token'ı doğrula
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  // 2. Kullanıcı bilgilerini al
  const payload = ticket.getPayload();
  if (!payload || payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub || !process.env.GOOGLE_CLIENT_ID) throw new Error('Google hesabı doğrulanamadı.');
  const email = normalizeEmail(payload.email), { name, picture } = payload;
  if (requireNonce && !/^[a-f0-9]{64}$/.test(payload.nonce || '')) throw new Error('Google giriş isteği doğrulanamadı.');

  let highResPicture = "";
  if (picture) {
    highResPicture = picture.replace(/=s\d+-c/g, '=s500-c');
  }

  // 3. Veritabanında bu maille kayıtlı (silinmemiş) kullanıcı var mı bak
  let user = await User.findOne({ googleSubject: payload.sub, isDeleted: false });
  if (!user) {
    user = await User.findOne({ email: emailPattern(email), isDeleted: false });
    if (user && (user.googleSubject && user.googleSubject !== payload.sub || !email.endsWith('@gmail.com') && !payload.hd)) throw new Error('Bu hesaba mevcut parolanızla giriş yapın; Google bağlantısı ayrıca doğrulanmalıdır.');
  }

  let isNewAccount = false;
  if (!user) {
    // Silinmiş bir hesapla aynı e-posta varsa net bir hata ver
    const deletedUser = await User.findOne({ email, isDeleted: true });
    if (deletedUser) {
      throw new Error('Bu e-posta adresine ait hesap silinmiş.');
    }

    // 4. Kullanıcı yoksa YENİ KAYIT oluştur.
    user = new User({
      fullName: name,
      email: email,
      username: email.split('@')[0] + Math.floor(Math.random() * 1000),
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
      googleSubject: payload.sub,
      isVerified: true,
      profilePicture: highResPicture
    });
    await user.save();
    isNewAccount = true;
  }

  if (user.loginBlocked) throw new Error('Giriş bilgileri geçersiz.');
  if (!user.googleSubject) user.googleSubject = payload.sub;
  if (!user.isActive) user.isActive = true;
  if (user.isModified()) await user.save();

  // 5. Kendi JWT token'ını üret
  const authToken = jwt.sign({ userId: user._id, version: user.authVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

  return { token: authToken, user, loginNonce: payload.nonce, isNewAccount };
};

// GraphQL mutation — mevcut popup akışını kullanan istemciler için korunuyor
export const googleAuth = async (token) => {
  return authenticateWithGoogleCredential(token);
};

export const findUserById = async (id, { includeDeleted = false } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) { query.isDeleted = false; query.isActive = { $ne: false }; }
  return await User.findOne(query);
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email, isDeleted: false });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username, isDeleted: false, isActive: { $ne: false } });
};

export const getAllUsers = async (options = {}) => {
  return await paginate(User.find({ isDeleted: false, isActive: { $ne: false } }).sort({ _id: 1 }), options);
};

// Takipçi/Takip edilen işlemleri için helper
export const getUserWithFollowing = async (id) => {
  return await User.findOne({ _id: id, isDeleted: false }).populate('following');
};

export const getUserWithFollowers = async (id) => {
  return await User.findOne({ _id: id, isDeleted: false }).populate('followers');
};

// 1. ADIM: KOD GÖNDERME
export const sendRegistrationCode = async (email, username) => {
  email = normalizeEmail(email); checkUsername(username);
  // Önce çakışma var mı kontrol et (silinmiş hesaplar hariç — email/username tekrar kullanılabilsin mi
  // istersen burada isDeleted:false filtresi eklenebilir; şu an mevcut davranış korunuyor)
  const existingUser = await User.findOne({ $or: [{ email: emailPattern(email) }, { username }] });
  if (existingUser) throw new Error('E-posta veya kullanıcı adı zaten kullanımda.');

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);

  const previousVerification = await Verification.findOneAndUpdate(
    { email },
    { code: codeHash, attempts: 0, createdAt: Date.now() },
    { upsert: true, new: false }
  );

  try { await transporter.sendMail({
    from: { name: 'Betik', address: process.env.EMAIL_USER },
    to: email,
    ...registrationEmail({ code, username }),
  }); } catch (error) {
    try {
      const filter = { email, code: codeHash };
      if (previousVerification) await Verification.updateOne(filter, { $set: { code: previousVerification.code, attempts: previousVerification.attempts || 0, createdAt: previousVerification.createdAt } });
      else await Verification.deleteOne(filter);
    } catch { console.error('SECURITY_REGISTRATION_CODE_ROLLBACK_FAILED'); }
    throw error;
  }

  return { code: 200, message: 'Doğrulama kodu e-postanıza gönderildi.' };
};

// 2. ADIM: ASIL KAYIT (REGISTER)
export const registerUser = async ({ username, fullName, email, password, code }, { startSession = false } = {}) => {
  email = normalizeEmail(email); checkUsername(username);
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120) throw new Error('Ad soyad 2–120 karakter olmalı.');
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Geçersiz veya süresi dolmuş doğrulama kodu.');
  const verification = await Verification.findOneAndUpdate({ email, createdAt: { $gt: new Date(Date.now() - 600000) }, $or: [{ attempts: { $lt: 5 } }, { attempts: { $exists: false } }] }, { $inc: { attempts: 1 } }, { new: true });
  // Legacy unexpired codes remain usable during rollout, with the same attempt cap.
  const validCode = verification && (verification.code.startsWith('$2') ? await bcrypt.compare(code, verification.code) : [code, tokenHash(code)].includes(verification.code));
  if (!validCode) {
    throw new Error('Geçersiz veya süresi dolmuş doğrulama kodu.');
  }

  const consumed = await Verification.deleteOne({ _id: verification._id, code: verification.code, attempts: verification.attempts });
  if (!consumed.deletedCount) throw new Error('Geçersiz veya süresi dolmuş doğrulama kodu.');
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = new User({ username, fullName: fullName.trim(), email, password: hashedPassword, isVerified: true });
  await user.save();

  if (startSession) {
    try {
      const token = jwt.sign({ userId: user._id, version: user.authVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return { code: 200, message: 'Kayıt başarıyla tamamlandı.', token, user };
    } catch {
      return { code: 200, message: 'Hesabınız oluşturuldu. Devam etmek için giriş yapın.', token: null, user: null };
    }
  }
  return { code: 200, message: 'Kayıt başarıyla tamamlandı.' };
};

// LOGIN
export const loginUser = async (email, password) => {
  email = normalizeEmail(email);
  if (typeof password !== 'string' || password.length > 4096) throw new Error('Giriş bilgileri geçersiz.');
  const user = await User.findOne({ email: emailPattern(email) });
  const valid = await bcrypt.compare(password, user?.password || dummyPasswordHash);
  if (!user || user.isDeleted || user.loginBlocked || !valid) throw new Error('Giriş bilgileri geçersiz.');

  // Devre dışı bırakılmış hesap — giriş yaptığı için otomatik yeniden aktive et
  // (DangerZone.jsx'teki "giriş yaparak hesabınızı yeniden aktif edebilirsiniz" metniyle tutarlı)
  if (!user.isActive) {
    user.isActive = true;
    await user.save();
  }

  const token = jwt.sign({ userId: user._id, version: user.authVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return { token, user };
};

// Compatibility for older clients: toggling now requests approval, never auto-follows.
export const toggleFollow = async (currentUserId, targetUserId) => {
  const status = await FollowService.getFollowStatus(currentUserId, targetUserId);
  if (status === 'FOLLOWING') return FollowService.unfollowUser(currentUserId, targetUserId);
  if (status === 'PENDING') return FollowService.cancelFollowRequest(currentUserId, targetUserId);
  return FollowService.requestFollow(currentUserId, targetUserId);
};

// TOGGLE SAVE BOOK
export const toggleSaveBook = async (userId, bookId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  if (user.savedBooks.includes(bookId)) {
    await User.findByIdAndUpdate(userId, { $pull: { savedBooks: bookId } });
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { savedBooks: bookId } });
  }
  return await User.findById(userId);
};

export const getSavedBooksByUserId = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false }).populate({
    path: 'savedBooks',
    match: { isDeleted: false },
  });
  return user?.savedBooks || [];
};

export const getUsersBooksByUserId = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false }).populate({
    path: 'usersBooks',
    match: { isDeleted: false },
  });
  return user?.usersBooks || [];
};

export const findUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  return await User.find({ _id: { $in: userIds }, isDeleted: false, isActive: { $ne: false } });
};
