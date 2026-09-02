// src/services/sessionService.js
import bcrypt from 'bcryptjs';
import Session from '../models/session.js';
import SessionEntry from '../models/sessionEntry.js';
import User from '../models/user.js';
import { pubsub } from '../../index.js';

import * as ScoreService from './scoreService.js';

const NEW_SESSION_ENTRY = 'NEW_SESSION_ENTRY';
const ENTRIES_PER_PAGE = 30;

// --- YARDIMCI: Kullanıcı erişim kontrolü ---
const checkAccess = async (session, userId) => {
  if (!session.isActive) throw new Error('Bu oturum kapatılmış.');

  if (session.type === 'OPEN') return true;

  if (session.type === 'FOLLOWERS_ONLY') {
    const creator = await User.findById(session.createdBy).select('followers');
    const isFollower = creator?.followers
      ?.map(id => id.toString())
      .includes(userId.toString());
    const isCreator = session.createdBy.toString() === userId.toString();
    if (!isFollower && !isCreator) {
      throw new Error('Bu oturuma sadece takipçiler katılabilir.');
    }
    return true;
  }

  if (session.type === 'PRIVATE') {
    throw new Error('Özel oturumlara erişmek için erişim kodu gereklidir.');
  }
};

// --- YARDIMCI: SessionEntry'yi serialize et ---
const populateEntry = (query) => {
  return query.populate('userId', 'username fullName profilePicture');
};

// --- SESSION ---
// Not: Tüm okuma sorguları varsayılan olarak isDeleted:false filtreli.
// Silinmiş bir oturuma erişim, "Oturum bulunamadı" hatasıyla sonuçlanır
// (query zaten sonuç döndürmediği için ekstra kontrol gerekmiyor).

export const createSession = async (userId, input) => {
  // Yazar kontrolü
  const user = await User.findById(userId).select('isPremium isVerified');
  if (!user?.isPremium) {
    throw new Error('Oturum açmak için doğrulanmış premium bir kullanıcı olmanız gerekir.');
  }

  const { title, description, type, accessCode, tags } = input;

  // PRIVATE ise accessCode zorunlu
  if (type === 'PRIVATE') {
    if (!accessCode || accessCode.trim().length < 4) {
      throw new Error('Özel oturumlar için en az 4 karakterli bir erişim kodu gereklidir.');
    }
  }

  const sessionData = {
    title,
    description: description ?? '',
    type,
    createdBy: userId,
    tags: tags ?? [],
  };

  // PRIVATE ise kodu hashle
  if (type === 'PRIVATE' && accessCode) {
    sessionData.accessCode = await bcrypt.hash(accessCode.trim(), 10);
  }

  const session = new Session(sessionData);
  await session.save();

  return Session.findById(session._id).populate('createdBy', 'username fullName profilePicture');
};

export const getSessions = async (limit = 20, offset = 0) => {
  return Session.find({ isActive: true, isDeleted: false })
    .populate('createdBy', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

export const getSessionById = async (sessionId, userId) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false })
    .populate('createdBy', 'username fullName profilePicture');

  if (!session) return null;

  // FOLLOWERS_ONLY kontrolü — ÖNEMLİ: koşul artık "&& userId" DEĞİL.
  // Eskiden bu kontrol sadece userId varsa çalışıyordu; misafir (userId
  // undefined) geldiğinde blok hiç çalışmıyor ve takipçilere özel bir
  // oturum, girişsiz herkese tamamen açık kalıyordu. Şimdi misafir
  // isteği de bu bloğa giriyor ve aşağıdaki "giriş yapın" hatasıyla
  // engelleniyor — davranış artık tutarlı.
  if (session.type === 'FOLLOWERS_ONLY') {
    if (!userId) {
      throw new Error('Bu oturuma sadece takipçiler erişebilir. Lütfen giriş yapın.');
    }
    const isCreator = session.createdBy._id.toString() === userId.toString();
    if (!isCreator) {
      const creator = await User.findById(session.createdBy._id).select('followers');
      const isFollower = creator?.followers
        ?.map(id => id.toString())
        .includes(userId.toString());
      if (!isFollower) throw new Error('Bu oturuma sadece takipçiler erişebilir.');
    }
  }

  return session;
};

export const closeSession = async (sessionId, userId) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false });
  if (!session) throw new Error('Oturum bulunamadı.');
  if (session.createdBy.toString() !== userId.toString()) {
    throw new Error('Sadece oturumu açan kişi kapatabilir.');
  }
  session.isActive = false;
  await session.save();
  return true;
};

// --- SESSION ENTRY ---

export const addSessionEntry = async (userId, sessionId, content, accessCode = null) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false });
  if (!session) throw new Error('Oturum bulunamadı.');

  // PRIVATE tipinde accessCode ile doğrulama
  if (session.type === 'PRIVATE') {
    if (!accessCode) throw new Error('Erişim kodu gereklidir.');
    const isValid = await bcrypt.compare(accessCode, session.accessCode);
    if (!isValid) throw new Error('Erişim kodu hatalı.');
  } else {
    await checkAccess(session, userId);
  }

  const entry = new SessionEntry({
    sessionId,
    userId,
    content: content.trim(),
  });
  await entry.save();
  await ScoreService.onSessionEntryAdded(userId);

  // participantCount: bu kullanıcı daha önce hiç yazmadıysa artır
  const previousEntry = await SessionEntry.findOne({
    sessionId,
    userId,
    isDeleted: false,
    _id: { $ne: entry._id },
  });
  if (!previousEntry) {
    await Session.findByIdAndUpdate(sessionId, {
      $inc: { participantCount: 1 },
    });
  }

  const populated = await populateEntry(SessionEntry.findById(entry._id));

  pubsub.publish(NEW_SESSION_ENTRY, {
    onNewSessionEntry: populated,
    sessionId: sessionId.toString(),
  });

  return populated;
};

export const getSessionEntries = async (sessionId, limit, offset, userId) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false });
  if (!session) throw new Error('Oturum bulunamadı.');

  // FOLLOWERS_ONLY kontrolü — getSessionById'deki aynı düzeltme burada da
  // uygulandı: artık "&& userId" değil, misafir istekleri de bu bloğa girip
  // engelleniyor.
  if (session.type === 'FOLLOWERS_ONLY') {
    if (!userId) {
      throw new Error('Bu oturuma sadece takipçiler erişebilir. Lütfen giriş yapın.');
    }
    const isCreator = session.createdBy.toString() === userId.toString();
    if (!isCreator) {
      const creator = await User.findById(session.createdBy).select('followers');
      const isFollower = creator?.followers
        ?.map(id => id.toString())
        .includes(userId.toString());
      if (!isFollower) throw new Error('Bu oturuma sadece takipçiler erişebilir.');
    }
  }

  return populateEntry(
    SessionEntry.find({ sessionId, isDeleted: false })
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
  );
};

// SOFT DELETE — daha önce SessionEntry.findByIdAndDelete ile hard-delete yapıyordu
export const deleteSessionEntry = async (entryId, userId) => {
  const entry = await SessionEntry.findOne({ _id: entryId, isDeleted: false });
  if (!entry) throw new Error('Yazı bulunamadı.');
  if (entry.userId.toString() !== userId.toString()) {
    throw new Error('Sadece kendi yazılarınızı silebilirsiniz.');
  }

  const sessionId = entry.sessionId;

  entry.isDeleted = true;
  entry.deletedAt = new Date();
  await entry.save();

  // Kullanıcının bu oturumda başka (silinmemiş) yazısı kaldı mı?
  const remainingEntry = await SessionEntry.findOne({ sessionId, userId, isDeleted: false });
  if (!remainingEntry) {
    await Session.findByIdAndUpdate(sessionId, {
      $inc: { participantCount: -1 },
    });
  }

  return true;
};

export const toggleSessionEntryLike = async (entryId, userId) => {
  const entry = await SessionEntry.findOne({ _id: entryId, isDeleted: false });
  if (!entry) throw new Error('Yazı bulunamadı.');

  const alreadyLiked = entry.likedBy
    .map(id => id.toString())
    .includes(userId.toString());

  alreadyLiked
    ? entry.likedBy.pull(userId)
    : entry.likedBy.push(userId);

  await entry.save();

  return populateEntry(SessionEntry.findById(entryId));
};

export const verifySessionAccessCode = async (sessionId, accessCode) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false });

  if (!session) throw new Error('Oturum bulunamadı.');
  if (session.type !== 'PRIVATE') return true;
  if (!session.accessCode) return false;
  return bcrypt.compare(accessCode?.trim(), session.accessCode);
};

// --- HESAP SİLME CASCADE'İ İÇİN YARDIMCI FONKSİYONLAR ---
// userService.js -> deleteAccountCompletely() tarafından çağrılır.

export const softDeleteSessionsByUserId = async (userId) => {
  await Session.updateMany(
    { createdBy: userId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date(), isActive: false }
  );
};

export const softDeleteSessionEntriesByUserId = async (userId) => {
  await SessionEntry.updateMany(
    { userId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );
};