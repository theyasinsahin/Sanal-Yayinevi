import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import Book from '../models/book.js';
import User from '../models/user.js';
import Quote from '../models/quote.js';

import Verification from '../models/verification.js'; // Yeni bir model gerekecek
import transporter from '../config/smtp.js';

import * as BookService from './bookService.js';
import * as SessionService from './sessionService.js';

import { validatePassword } from '../utils/passwordValidation.js';

import dotenv from 'dotenv';
dotenv.config();

import { OAuth2Client } from 'google-auth-library';

// ── Hesap: E-posta Değiştirme ─────────────────────────────────────
export const changeEmail = async (userId, { newEmail, currentPassword }) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  // Mevcut şifre doğrulaması
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error('Mevcut şifre hatalı.');

  // Yeni e-posta başka biri tarafından kullanılıyor mu?
  const taken = await User.findOne({ email: newEmail, _id: { $ne: userId } });
  if (taken) throw new Error('Bu e-posta adresi zaten kullanılıyor.');

  user.email = newEmail;
  await user.save();

  // İsteğe bağlı: doğrulama maili gönder
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: newEmail,
    subject: 'Quill - E-posta Değişikliği',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>E-posta Değişikliği</h2>
        <p>E-posta adresiniz başarıyla değiştirildi.</p>
        <p style="color:#888; margin-top:16px;">Eğer bu işlemi siz yapmadıysanız hemen bizimle iletişime geçin.</p>
      </div>
    `
  });

  return { code: 200, message: 'E-posta güncellendi.' };
};

export const forgotPassword = async (email) => {
  const user = await User.findOne({ email, isDeleted: false });
  // Güvenlik için kullanıcı bulunamasa da aynı mesajı dön
  if (!user) return { code: 200, message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi.' };

  // Güvenli random token üret
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

  // Token'ı DB'ye kaydet
  user.resetPasswordToken = token;
  user.resetPasswordExpires = expires;
  await user.save();

  // Sıfırlama linki
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Quill - Şifre Sıfırlama',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Şifre Sıfırlama</h2>
        <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
        <a href="${resetUrl}" 
           style="display:inline-block; padding: 12px 24px; background:#2563EB; color:#fff; border-radius:6px; text-decoration:none;">
          Şifremi Sıfırla
        </a>
        <p style="color:#888; margin-top:16px;">Bu bağlantı <b>1 saat</b> geçerlidir.</p>
        <p style="color:#888;">Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
      </div>
    `
  });

  return { code: 200, message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi.' };
};

// ── Hesap: Şifre Değiştirme ───────────────────────────────────────
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error('Mevcut şifre hatalı.');

  if (newPassword.length < 8) throw new Error('Yeni şifre en az 8 karakter olmalı.');

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return { code: 200, message: 'Şifre başarıyla değiştirildi.' };
};

// ── Ayarlar: Gizlilik ─────────────────────────────────────────────
export const updatePrivacySettings = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  Object.assign(user.privacySettings, input);
  user.markModified('privacySettings');
  return user.save();
};

// ── Ayarlar: Bildirimler ──────────────────────────────────────────
export const updateNotificationSettings = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  Object.assign(user.notificationSettings, input);
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

  Object.assign(user.authorSettings, input);
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
  if (passwordError) throw new Error(passwordError);

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
    isDeleted: false,
  });

  if (!user) throw new Error('Geçersiz veya süresi dolmuş bağlantı.');

  // Yeni şifreyi hashle
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  return { code: 200, message: 'Şifreniz başarıyla güncellendi.' };
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Google credential doğrulama — ORTAK ÇEKİRDEK ─────────────────
// Hem GraphQL mutation'ı (googleAuth, popup akışı için) hem de
// REST /auth/google/callback route'u (redirect akışı için) bu
// fonksiyonu kullanır. Böylece iki farklı giriş noktasında Google
// doğrulama/kullanıcı oluşturma mantığı birbirinden sapmaz.
export const authenticateWithGoogleCredential = async (idToken) => {
  // 1. Google'dan token'ı doğrula
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  // 2. Kullanıcı bilgilerini al
  const payload = ticket.getPayload();
  const { email, name, picture } = payload;

  let highResPicture = "";
  if (picture) {
    highResPicture = picture.replace(/=s\d+-c/g, '=s500-c');
  }

  // 3. Veritabanında bu maille kayıtlı (silinmemiş) kullanıcı var mı bak
  let user = await User.findOne({ email, isDeleted: false });

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
      password: 'google_auth_placeholder_password',
      isVerified: true,
      profilePicture: highResPicture
    });
    await user.save();
  }

  // 5. Kendi JWT token'ını üret
  const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  return { token: authToken, user };
};

// GraphQL mutation — mevcut popup akışını kullanan istemciler için korunuyor
export const googleAuth = async (token) => {
  return authenticateWithGoogleCredential(token);
};

export const findUserById = async (id, { includeDeleted = false } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) query.isDeleted = false;
  return await User.findOne(query);
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email, isDeleted: false });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username, isDeleted: false });
};

export const getAllUsers = async () => {
  return await User.find({ isDeleted: false });
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
  // Önce çakışma var mı kontrol et (silinmiş hesaplar hariç — email/username tekrar kullanılabilsin mi
  // istersen burada isDeleted:false filtresi eklenebilir; şu an mevcut davranış korunuyor)
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) throw new Error('Email veya kullanıcı adı zaten kullanımda.');

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await Verification.findOneAndUpdate(
    { email },
    { code, createdAt: Date.now() },
    { upsert: true, new: true }
  );

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Quill - Doğrulama Kodu',
    text: `Doğrulama kodunuz: ${code}`
  });

  return { code: 200, message: 'Doğrulama kodu e-postanıza gönderildi.' };
};

// 2. ADIM: ASIL KAYIT (REGISTER)
export const registerUser = async ({ username, fullName, email, password, code }) => {
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const verification = await Verification.findOne({ email });
  if (!verification || verification.code !== code) {
    throw new Error('Geçersiz veya süresi dolmuş doğrulama kodu.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, fullName, email, password: hashedPassword });
  await user.save();

  await Verification.deleteOne({ email });

  return { code: 200, message: 'Kayıt başarıyla tamamlandı.' };
};

// LOGIN
export const loginUser = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Kullanıcı bulunamadı");

  // Silinmiş hesapla giriş engellenmeli
  if (user.isDeleted) throw new Error("Bu hesap silinmiş.");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Hatalı şifre");

  // Devre dışı bırakılmış hesap — giriş yaptığı için otomatik yeniden aktive et
  // (DangerZone.jsx'teki "giriş yaparak hesabınızı yeniden aktif edebilirsiniz" metniyle tutarlı)
  if (!user.isActive) {
    user.isActive = true;
    await user.save();
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return { token, user };
};

// TOGGLE FOLLOW
export const toggleFollow = async (currentUserId, targetUserId) => {
  const user = await User.findOne({ _id: currentUserId, isDeleted: false });
  const targetUser = await User.findOne({ _id: targetUserId, isDeleted: false });
  if (!user || !targetUser) throw new Error('Kullanıcı bulunamadı.');

  if (user.following.includes(targetUserId)) {
    user.following.pull(targetUserId);
    targetUser.followers.pull(currentUserId);
    await user.save();
    await targetUser.save();
    return { code: 200, message: "Takip bırakıldı" };
  } else {
    user.following.push(targetUserId);
    targetUser.followers.push(currentUserId);
    await user.save();
    await targetUser.save();
    return { code: 200, message: "Takip edildi" };
  }
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
  return await User.find({ _id: { $in: userIds }, isDeleted: false });
};