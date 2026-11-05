// src/services/sessionService.js
import bcrypt from 'bcryptjs';
import { notifyUser } from './notificationService.js';
import { notifyMentions } from './mentionService.js';
import { inactiveUserIds } from '../utils/activeUsers.js';
import Session from '../models/session.js';
import SessionEntry from '../models/sessionEntry.js';
import User from '../models/user.js';
import { pubsub } from '../config/pubsub.js';

import * as ScoreService from './scoreService.js';
import { normalizeSessionCover } from '../utils/sessionCover.js';
import { checkRate, consumeRate } from '../security/rateLimit.js';

const NEW_SESSION_ENTRY = 'NEW_SESSION_ENTRY';
const ENTRIES_PER_PAGE = 30;

async function validSessionCode(session, accessCode, userId, context) {
  const req = context?.req || context?.socketRequest;
  const identities = req ? [`ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`, ...(userId ? [`user:${userId}`] : [])] : [];
  const scope = `private-session-code:${session.id}`, windowMs = 15 * 60000;
  for (const identity of identities) await checkRate(scope, identity, 10, windowMs);
  const valid = typeof accessCode === 'string' && accessCode.length <= 72 && session.accessCode && await bcrypt.compare(accessCode.trim(), session.accessCode);
  if (!valid) for (const identity of identities) await consumeRate(scope, identity, 10, windowMs);
  return Boolean(valid);
}

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

async function mentionSession(userId, session, content, entryId) {
  const creator = session.type === 'FOLLOWERS_ONLY' ? await User.findById(session.createdBy).select('followers') : null;
  const participants = session.type === 'PRIVATE'
    ? new Set([String(session.createdBy), ...(await SessionEntry.distinct('userId', { sessionId: session._id, isDeleted: false })).map(String)]) : null;
  return notifyMentions({ actorId: userId, content, type: 'SESSION_MENTION', message: `${session.title} oturumunda etiketlendin.`,
    meta: { sessionId: String(session._id), ...(entryId ? { entryId: String(entryId) } : {}) },
    canAccess: recipient => session.type === 'FOLLOWERS_ONLY'
      ? String(recipient._id) === String(session.createdBy) || creator?.followers.some(id => String(id) === String(recipient._id))
      : session.type !== 'PRIVATE' || participants.has(String(recipient._id)),
  });
}

// --- SESSION ---
// Not: Tüm okuma sorguları varsayılan olarak isDeleted:false filtreli.
// Silinmiş bir oturuma erişim, "Oturum bulunamadı" hatasıyla sonuçlanır
// (query zaten sonuç döndürmediği için ekstra kontrol gerekmiyor).

export const createSession = async (userId, input) => {
  const user = await User.findOne({ _id: userId, isDeleted: false, isActive: { $ne: false } }).select('sessionCreationAccess');
  if (user?.sessionCreationAccess?.status !== 'APPROVED') {
    throw new Error('Oturum açmak için yönetici onaylı oturum oluşturma izni gerekir.');
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
    coverImageUrl: normalizeSessionCover(input.coverImageUrl),
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

  await mentionSession(userId, session, session.description);

  return Session.findById(session._id).populate('createdBy', 'username fullName profilePicture');
};

export const getSessions = async (limit = 20, offset = 0) => {
  return Session.find({ isActive: true, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } })
    .populate('createdBy', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

export async function updateSessionCover(user, sessionId, coverImageUrl) {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false }).exec();
  if (!session) throw new Error('Oturum bulunamadı.');
  if (String(session.createdBy) !== String(user._id) && user.role !== 'ADMIN') throw new Error('Yalnızca kendi oturumunuzun kapağını değiştirebilirsiniz.');
  return Session.findOneAndUpdate({ _id: sessionId, isDeleted: false }, { $set: { coverImageUrl: normalizeSessionCover(coverImageUrl) } }, { new: true, runValidators: true })
    .populate('createdBy', 'username fullName profilePicture').exec();
}

export const getSessionById = async (sessionId, userId) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } })
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
  const session = await Session.findOne({ _id: sessionId, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } });
  if (!session) throw new Error('Oturum bulunamadı.');
  if (session.createdBy.toString() !== userId.toString()) {
    throw new Error('Sadece oturumu açan kişi kapatabilir.');
  }
  session.isActive = false;
  await session.save();
  return true;
};

// --- SESSION ENTRY ---

export const addSessionEntry = async (userId, sessionId, content, accessCode = null, context) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } });
  if (!session) throw new Error('Oturum bulunamadı.');
  if (!session.isActive) throw new Error('Bu oturum kapatılmış.');

  // PRIVATE tipinde accessCode ile doğrulama
  if (session.type === 'PRIVATE') {
    if (!accessCode) throw new Error('Erişim kodu gereklidir.');
    const isValid = await validSessionCode(session, accessCode, userId, context);
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
  await ScoreService.onSessionEntryAdded(userId, entry._id);

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

  const mentioned = await mentionSession(userId, session, entry.content, entry._id);
  const recipients = new Set([String(session.createdBy), ...(await SessionEntry.distinct('userId', { sessionId, isDeleted: false })).map(String)]);
  for (const recipientId of mentioned) recipients.delete(recipientId);
  for (const recipientId of recipients) {
    await notifyUser(recipientId, 'sessionReply', { type: 'SESSION_REPLY', title: 'Oturuma yeni bir ileti eklendi', message: session.title + ' oturumunda yeni bir ileti var.', icon: '💬', meta: { sessionId, entryId: String(entry._id) } }, userId);
  }
  const populated = await populateEntry(SessionEntry.findById(entry._id));

  pubsub.publish(NEW_SESSION_ENTRY, {
    onNewSessionEntry: populated,
    sessionId: sessionId.toString(),
  });

  return populated;
};

export const getSessionEntries = async (sessionId, limit, offset, userId, accessCode, context) => {
  return readSessionEntries(sessionId, limit, offset, userId, accessCode, context);
};

export async function getSessionEntry(sessionId, entryId, userId, accessCode, context) {
  await requireSessionRead(sessionId, userId, accessCode, context);
  return populateEntry(SessionEntry.findOne({ _id: entryId, sessionId, isDeleted: false, userId: { $nin: await inactiveUserIds() } }));
}

export async function requireSessionRead(sessionId, userId, accessCode, context) {
  const session = await getSessionById(sessionId, userId);
  if (!session) throw new Error('Oturum bulunamadı.');
  if (session.type === 'PRIVATE' && String(session.createdBy._id || session.createdBy) !== String(userId)) {
    if (!await validSessionCode(session, accessCode, userId, context)) throw new Error('Özel oturum için geçerli erişim kodu gereklidir.');
  }
  return session;
}

export const readSessionEntries = async (sessionId, limit = 30, offset = 0, userId, accessCode, context) => {
  await requireSessionRead(sessionId, userId, accessCode, context);
  const session = await Session.findOne({ _id: sessionId, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } });
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
    SessionEntry.find({ sessionId, isDeleted: false, userId: { $nin: await inactiveUserIds() } })
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

export const toggleSessionEntryLike = async (entryId, userId, accessCode, context) => {
  const entry = await SessionEntry.findOne({ _id: entryId, isDeleted: false });
  if (!entry) throw new Error('Yazı bulunamadı.');
  await requireSessionRead(entry.sessionId, userId, accessCode, context);

  const alreadyLiked = entry.likedBy
    .map(id => id.toString())
    .includes(userId.toString());

  alreadyLiked
    ? entry.likedBy.pull(userId)
    : entry.likedBy.push(userId);

  await entry.save();

  return populateEntry(SessionEntry.findById(entryId));
};

export const verifySessionAccessCode = async (sessionId, accessCode, context) => {
  const session = await Session.findOne({ _id: sessionId, isDeleted: false, createdBy: { $nin: await inactiveUserIds() } });

  if (!session) throw new Error('Oturum bulunamadı.');
  if (session.type !== 'PRIVATE') return true;
  if (!session.accessCode) return false;
  return validSessionCode(session, accessCode, context?.user?._id, context);
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
