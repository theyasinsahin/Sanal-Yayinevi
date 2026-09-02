import * as MessageService from '../../services/messageService.js';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../../../index.js';

const NEW_MESSAGE = 'NEW_MESSAGE';

// Message dökümanını serialize et
const serializeMessage = (msg) => {
  if (!msg) return null;
  const obj = typeof msg.toObject === 'function' ? msg.toObject() : msg;

  // Populate edilmiş senderId'yi sender olarak normalize et
  let sender = null;
  if (obj.senderId && typeof obj.senderId === 'object' && obj.senderId.username) {
    sender = {
      ...obj.senderId,
      id: obj.senderId._id?.toString(),
    };
  }

  return {
    ...obj,
    id: obj._id?.toString(),
    conversationId: obj.conversationId?.toString(),
    senderId: obj.senderId,
    sender,  // ← normalize edilmiş sender'ı ekle
    createdAt: obj.createdAt
      ? new Date(obj.createdAt).toISOString()
      : new Date().toISOString(),
  };
};

// Conversation dökümanını serialize et
const serializeConversation = (conv, currentUserId) => {
  const obj = typeof conv.toObject === 'function' ? conv.toObject() : conv;

  // lastMessage: populate edilmişse (_id alanı varsa) serialize et
  let lastMessage = null;
  if (obj.lastMessage && typeof obj.lastMessage === 'object' && obj.lastMessage._id) {
    lastMessage = serializeMessage(obj.lastMessage);
  }

  return {
    ...obj,
    id: obj._id?.toString(),
    participants: (obj.participants ?? []).map(p => {
      const pObj = typeof p.toObject === 'function' ? p.toObject() : p;
      return { ...pObj, id: pObj._id?.toString() };
    }),
    lastMessage,
    unreadCount: conv.unreadCounts?.get
      ? (conv.unreadCounts.get(currentUserId?.toString()) ?? 0)
      : 0,
    updatedAt: obj.updatedAt
      ? new Date(obj.updatedAt).toISOString()
      : new Date().toISOString(),
  };
};

export default {
  Query: {
    getConversations: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const convs = await MessageService.getUserConversations(user._id);
      return convs.map(c => serializeConversation(c, user._id));
    },

    getConversation: async (_, { conversationId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const conv = await MessageService.getConversationById(conversationId);
      if (!conv) return null;
      return serializeConversation(conv, user._id);
    },

    getMessages: async (_, { conversationId, limit = 20, offset = 0 }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const messages = await MessageService.getConversationMessages(conversationId, limit, offset);
      return messages.map(serializeMessage);
    },

    getOrCreateConversation: async (_, { recipientId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const conv = await MessageService.getOrCreateConversation(user._id, recipientId);
      if (!conv) return null;
      return serializeConversation(conv, user._id);
    },

    getUnreadMessageCount: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return MessageService.getUnreadMessageCount(user._id);
    },
  },

  Mutation: {
    sendMessage: async (_, { input }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const msg = await MessageService.sendMessage(user._id, input);
      return serializeMessage(msg);
    },

    markMessagesAsRead: async (_, { conversationId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      await MessageService.markMessagesAsRead(conversationId, user._id);
      return true;
    },

    deleteMessage: async (_, { messageId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      await MessageService.deleteMessage(messageId, user._id);
      return true;
    },

    editMessage: async (_, { messageId, content }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const msg = await MessageService.editMessage(messageId, user._id, content);
      return serializeMessage(msg);
    },
  },

  Subscription: {
    onNewMessage: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(NEW_MESSAGE),
        (payload, variables) => {
          return payload.conversationId === variables.conversationId;
        }
      ),
      resolve: (payload) => payload.onNewMessage,
    },
  },

  Message: {
    id: (parent) => parent._id?.toString() ?? parent.id,

    // senderId populate edilmişse direkt dön, değilse DB'den çek
    sender: (parent, _, { User }) => {
      const sid = parent.senderId;
      if (!sid) return null;

      // Populate edilmiş obje mi?
      if (typeof sid === 'object' && sid.username) {
        // _id'yi id olarak normalize et
        return {
          ...sid,
          id: sid._id?.toString() ?? sid.id,
        };
      }

      // ObjectId veya string ise DB'den çek (silinmiş kullanıcıyı gösterme)
      const id = sid._id ?? sid;
      return User.findOne({ _id: id, isDeleted: false });
    },

    content: (parent) => parent.content ?? '',

    attachedQuote: async (parent, _, { Quote }) => {
  const qid = parent.attachedQuoteId;
  if (!qid) return null;

  // Populate edilmiş Mongoose dökümanı mı?
  if (typeof qid === 'object' && qid._id) {
    const q = typeof qid.toObject === 'function' ? qid.toObject() : qid;

    // Silinmiş bir alıntı populate edilmiş olsa bile gösterme
    if (q.isDeleted) return null;

    // İç içe populate edilmiş userId ve bookId'yi de normalize et
    const normalizeRef = (ref) => {
      if (!ref) return null;
      const obj = typeof ref.toObject === 'function' ? ref.toObject() : ref;
      return { ...obj, id: obj._id?.toString() };
    };

    return {
      ...q,
      id: q._id.toString(),
      userId: normalizeRef(q.userId),
      bookId: normalizeRef(q.bookId),
    };
  }

  // Ham ObjectId ise DB'den çek (silinmiş alıntıyı hariç tut)
  try {
    const quote = await Quote.findOne({ _id: qid._id ?? qid, isDeleted: false })
      .populate('userId', 'username fullName profilePicture')
      .populate('bookId', 'title imageUrl');

    if (!quote) return null;
    const q = quote.toObject();

    const normalizeRef = (ref) => {
      if (!ref) return null;
      return { ...ref, id: ref._id?.toString() };
    };

    return {
      ...q,
      id: q._id.toString(),
      userId: normalizeRef(q.userId),
      bookId: normalizeRef(q.bookId),
    };
  } catch {
    return null;
  }
},

    attachedBook: async (parent, _, { Book }) => {
      const bid = parent.attachedBookId;
      if (!bid) return null;

      if (typeof bid === 'object' && bid._id) {
        // Silinmiş bir kitap populate edilmiş olsa bile gösterme
        if (bid.isDeleted) return null;
        return { ...bid, id: bid._id?.toString() };
      }

      try {
        const book = await Book.findOne({ _id: bid._id ?? bid, isDeleted: false })
          .populate('authorId', 'username fullName profilePicture');
        return book;
      } catch {
        return null;
      }
    },

    createdAt: (parent) =>
      parent.createdAt
        ? new Date(parent.createdAt).toISOString()
        : new Date().toISOString(),
  },

  Conversation: {
    id: (parent) => parent._id?.toString() ?? parent.id,

    unreadCount: (parent, _, { user }) => {
      const userId = user?._id?.toString();
      if (!userId) return 0;
      // Map veya plain object olabilir
      if (typeof parent.unreadCounts?.get === 'function') {
        return parent.unreadCounts.get(userId) ?? 0;
      }
      return parent.unreadCounts?.[userId] ?? 0;
    },

    updatedAt: (parent) =>
      parent.updatedAt
        ? new Date(parent.updatedAt).toISOString()
        : new Date().toISOString(),
  },
};