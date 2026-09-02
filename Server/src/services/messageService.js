// src/services/messageService.js
import Message from '../models/message.js';
import Conversation from '../models/conversation.js';
import { pubsub } from '../../index.js';

const NEW_MESSAGE = 'NEW_MESSAGE';

// --- CONVERSATION ---

export const getOrCreateConversation = async (userIdA, userIdB) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [userIdA, userIdB] },
    isGroup: false,
  })
  .populate('participants', 'username fullName profilePicture')
  .populate({
    path: 'lastMessage',
    populate: { path: 'senderId', select: 'username profilePicture' },
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [userIdA, userIdB],
      unreadCounts: {
        [userIdA.toString()]: 0,
        [userIdB.toString()]: 0,
      },
    });
    await conversation.save();

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'username profilePicture' },
      });
  }

  return conversation;
};

export const getConversationById = async (conversationId) => {
  return Conversation.findById(conversationId)
    .populate('participants', 'username fullName profilePicture')
    .populate({
      path: 'lastMessage',
      populate: { path: 'senderId', select: 'username profilePicture' },
    });
};

export const getUserConversations = async (userId) => {
  return Conversation.find({ participants: userId })
    .populate('participants', 'username fullName profilePicture')
    .populate({
      path: 'lastMessage',
      populate: { path: 'senderId', select: 'username profilePicture' },
    })
    .sort({ updatedAt: -1 });
};

// --- MESAJ ---

export const sendMessage = async (senderId, { conversationId, content, type = 'TEXT', attachedQuoteId, attachedBookId }) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Konuşma bulunamadı.');
  if (!conversation.participants.map(p => p.toString()).includes(senderId.toString())) {
    throw new Error('Bu konuşmaya erişim yetkiniz yok.');
  }

  const message = new Message({
    conversationId,
    senderId,
    content: content ?? '',
    type,
    attachedQuoteId: attachedQuoteId ?? null,
    attachedBookId:  attachedBookId  ?? null,
  });
  await message.save();

  // Sender dışındaki tüm katılımcıların unreadCount'ını artır
  for (const participantId of conversation.participants) {
    if (participantId.toString() !== senderId.toString()) {
      const current = conversation.unreadCounts.get(participantId.toString()) || 0;
      conversation.unreadCounts.set(participantId.toString(), current + 1);
    }
  }

  conversation.lastMessage  = message._id;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Mesajı populate et, subscription'a yayınla
  const populated = await Message.findById(message._id)
  .populate('senderId', 'username fullName profilePicture')
  .populate({
    path: 'attachedQuoteId',
    populate: [
      { path: 'userId', select: 'username fullName profilePicture' },
      { path: 'bookId', select: 'title imageUrl' },
    ]
  })
  .populate({
    path: 'attachedBookId',
    populate: { path: 'authorId', select: 'username fullName profilePicture' }
  });

  pubsub.publish(NEW_MESSAGE, {
    onNewMessage: populated,
    conversationId: conversationId.toString(),
  });

  return populated;
};

export const getConversationMessages = async (conversationId, limit = 20, offset = 0) => {
  return Message.find({ conversationId, isDeleted: { $ne: true } })
  .populate('senderId', 'username fullName profilePicture')
  .populate({
    path: 'attachedQuoteId',
    populate: [
      { path: 'userId', select: 'username fullName profilePicture' },
      { path: 'bookId', select: 'title imageUrl' },
    ]
  })
  .populate({
    path: 'attachedBookId',
    populate: { path: 'authorId', select: 'username fullName profilePicture' }
  })
  .sort({ createdAt: -1 })
  .skip(offset)
  .limit(limit);
};

export const markMessagesAsRead = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Konuşma bulunamadı.');
  conversation.unreadCounts.set(userId.toString(), 0);
  await conversation.save();
  return conversation;
};

export const deleteMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) throw new Error('Mesaj bulunamadı.');
  if (message.senderId.toString() !== userId.toString()) {
    throw new Error('Sadece kendi mesajlarınızı silebilirsiniz.');
  }
  await Message.findByIdAndUpdate(messageId, { isDeleted: true, deletedAt: new Date() });
  return { code: 200, message: 'Mesaj silindi.' };
};

export const editMessage = async (messageId, userId, newContent) => {
  const message = await Message.findById(messageId);
  if (!message) throw new Error('Mesaj bulunamadı.');
  if (message.senderId.toString() !== userId.toString()) {
    throw new Error('Sadece kendi mesajlarınızı düzenleyebilirsiniz.');
  }
  if (message.type !== 'TEXT') throw new Error('Sadece metin mesajları düzenlenebilir.');
  message.content = newContent;
  await message.save();
  return message;
};

export const getUnreadMessageCount = async (userId) => {
  const conversations = await Conversation.find({ participants: userId });
  return conversations.reduce((total, conv) => {
    return total + (conv.unreadCounts.get(userId.toString()) || 0);
  }, 0);
};

export const searchMessages = async (conversationId, keyword) => {
  return Message.find({
    conversationId,
    isDeleted: { $ne: true },
    content: { $regex: keyword, $options: 'i' },
  }).populate('senderId', 'username profilePicture');
};