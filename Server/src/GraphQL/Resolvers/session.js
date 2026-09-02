// src/graphql/resolvers/session.js
import * as SessionService from '../../services/sessionService.js';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../../../index.js';

const NEW_SESSION_ENTRY = 'NEW_SESSION_ENTRY';

// Session dökümanını serialize et
const serializeSession = (session) => {
  if (!session) return null;
  const obj = typeof session.toObject === 'function' ? session.toObject() : session;

  return {
    ...obj,
    id: obj._id?.toString(),
    createdBy: obj.createdBy
      ? { ...obj.createdBy, id: obj.createdBy._id?.toString() }
      : null,
    createdAt: obj.createdAt
      ? new Date(obj.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: obj.updatedAt
      ? new Date(obj.updatedAt).toISOString()
      : new Date().toISOString(),
  };
};

// SessionEntry dökümanını serialize et
const serializeEntry = (entry) => {
  if (!entry) return null;
  const obj = typeof entry.toObject === 'function' ? entry.toObject() : entry;

  return {
    ...obj,
    id: obj._id?.toString(),
    sessionId: obj.sessionId?.toString(),
    user: obj.userId
      ? { ...obj.userId, id: obj.userId._id?.toString() }
      : null,
    likedBy: (obj.likedBy ?? []).map(id => id.toString()),
    likeCount: (obj.likedBy ?? []).length,
    createdAt: obj.createdAt
      ? new Date(obj.createdAt).toISOString()
      : new Date().toISOString(),
  };
};

export default {
  Query: {
    // Oturum listesi — girişsiz de görülebilir. Sadece yazı ekleme
    // (addSessionEntry) ve oturum açma (createSession) gibi Mutation'lar
    // giriş gerektiriyor, aşağıda değişmedi.
    getSessions: async (_, { limit = 20, offset = 0 }) => {
      const sessions = await SessionService.getSessions(limit, offset);
      return sessions.map(serializeSession);
    },

    // Tek oturum detayı — girişsiz de görülebilir. user artık opsiyonel;
    // context'te user yoksa undefined geçilir, servis bunu misafir
    // olarak ele alır (FOLLOWERS_ONLY kontrolü servis tarafında yapılıyor).
    getSession: async (_, { sessionId }, { user }) => {
      const session = await SessionService.getSessionById(sessionId, user?._id);
      return serializeSession(session);
    },

    // Oturumdaki yazılar — girişsiz de görülebilir.
    getSessionEntries: async (_, { sessionId, limit = 30, offset = 0 }, { user }) => {
      const entries = await SessionService.getSessionEntries(sessionId, limit, offset, user?._id);
      return entries.map(serializeEntry);
    },

    // PRIVATE oturuma erişim kodu doğrulama — bunu da girişsiz kullanıcı
    // yapabilmeli (özel bir oturuma koduyla girmek için üye olması şart değil).
    verifySessionAccessCode: async (_, { sessionId, accessCode }) => {
      return SessionService.verifySessionAccessCode(sessionId, accessCode);
    },
  },

  Mutation: {
    // --- Aşağıdaki tüm Mutation'lar giriş gerektirmeye devam ediyor ---
    createSession: async (_, { input }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const session = await SessionService.createSession(user._id, input);
      return serializeSession(session);
    },

    addSessionEntry: async (_, { sessionId, content, accessCode }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const entry = await SessionService.addSessionEntry(
        user._id,
        sessionId,
        content,
        accessCode ?? null
      );
      return serializeEntry(entry);
    },

    deleteSessionEntry: async (_, { entryId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return SessionService.deleteSessionEntry(entryId, user._id);
    },

    toggleSessionEntryLike: async (_, { entryId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const entry = await SessionService.toggleSessionEntryLike(entryId, user._id);
      return serializeEntry(entry);
    },

    closeSession: async (_, { sessionId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return SessionService.closeSession(sessionId, user._id);
    },
  },

  Subscription: {
    onNewSessionEntry: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(NEW_SESSION_ENTRY),
        (payload, variables) => {
          return payload.sessionId === variables.sessionId;
        }
      ),
      resolve: (payload) => serializeEntry(payload.onNewSessionEntry),
    },
  },

  // Field resolver — Session.createdBy populate edilmemişse DB'den çek
  Session: {
    id: (parent) => parent._id?.toString() ?? parent.id,

    createdBy: (parent, _, { User }) => {
      const creator = parent.createdBy;
      if (!creator) return null;
      if (typeof creator === 'object' && creator.username) return creator;
      const id = creator._id ?? creator;
      return User.findById(id);
    },

    createdAt: (parent) =>
      parent.createdAt
        ? new Date(parent.createdAt).toISOString()
        : new Date().toISOString(),

    updatedAt: (parent) =>
      parent.updatedAt
        ? new Date(parent.updatedAt).toISOString()
        : new Date().toISOString(),
  },

  // Field resolver — SessionEntry.user populate edilmemişse DB'den çek
  SessionEntry: {
    id: (parent) => parent._id?.toString() ?? parent.id,

    user: (parent, _, { User }) => {
      // serializeEntry'den gelen user objesi
      if (parent.user && typeof parent.user === 'object' && parent.user.username) {
        return parent.user;
      }
      // populate edilmemiş userId durumu
      const uid = parent.userId ?? parent.user;
      if (!uid) return null;
      const id = uid._id ?? uid;
      return User.findById(id);
    },

    likeCount: (parent) => parent.likedBy?.length ?? 0,

    createdAt: (parent) =>
      parent.createdAt
        ? new Date(parent.createdAt).toISOString()
        : new Date().toISOString(),
  },
};