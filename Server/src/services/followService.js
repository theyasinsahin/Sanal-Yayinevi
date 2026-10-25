import mongoose from 'mongoose';
import User from '../models/user.js';
import FollowRequest from '../models/followRequest.js';
import Notification from '../models/notification.js';
import { inactiveUserIds } from '../utils/activeUsers.js';

const active = { isDeleted: false, isActive: { $ne: false } };
const result = (message, followStatus, request = null) => ({ code: 200, message, followStatus, request });

async function pair(requesterId, recipientId, session) {
  if (String(requesterId) === String(recipientId)) throw new Error('Kendinize takip isteği gönderemezsiniz.');
  const requester = await User.findOne({ _id: requesterId, ...active }).session(session);
  const recipient = await User.findOne({ _id: recipientId, ...active }).session(session);
  if (!requester || !recipient) throw new Error('Kullanıcı bulunamadı.');
  return { requester, recipient };
}

async function transaction(operation) {
  // Build the new collection/indexes before entering a transaction.
  await Promise.all([FollowRequest.init(), Notification.init()]);
  return mongoose.connection.transaction(operation);
}

export async function getFollowStatus(requesterId, recipientId) {
  if (!requesterId || String(requesterId) === String(recipientId)) return 'NOT_FOLLOWING';
  if (await User.exists({ _id: requesterId, following: recipientId, ...active })) return 'FOLLOWING';
  return await FollowRequest.exists({ requesterId, recipientId, status: 'PENDING' }) ? 'PENDING' : 'NOT_FOLLOWING';
}

export async function requestFollow(requesterId, recipientId) {
  try {
    return await transaction(async session => {
      const { requester, recipient } = await pair(requesterId, recipientId, session);
      if (requester.following.some(id => String(id) === String(recipientId))) return result('Bu kullanıcıyı zaten takip ediyorsunuz.', 'FOLLOWING');
      let request = await FollowRequest.findOne({ requesterId, recipientId, status: 'PENDING' }).session(session);
      if (request) return result('Takip isteğiniz onay bekliyor.', 'PENDING', request);
      [request] = await FollowRequest.create([{ requesterId, recipientId }], { session });
      // Approval requests are actionable account notifications, regardless of the
      // optional preference for informational "new follower" notifications.
      await Notification.create([{
        userId: recipientId, type: 'FOLLOW_REQUEST', title: 'Yeni takip isteği',
        message: `${requester.username} sizi takip etmek istiyor.`, icon: '👤',
        meta: { followRequestId: request._id, requesterId, status: 'PENDING' },
      }], { session });
      return result('Takip isteği gönderildi.', 'PENDING', request);
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const request = await FollowRequest.findOne({ requesterId, recipientId, status: 'PENDING' });
    if (!request) throw error;
    return result('Takip isteğiniz onay bekliyor.', 'PENDING', request);
  }
}

export async function cancelFollowRequest(requesterId, recipientId) {
  return transaction(async session => {
    const { requester } = await pair(requesterId, recipientId, session);
    const request = await FollowRequest.findOneAndUpdate(
      { requesterId, recipientId, status: 'PENDING' },
      { status: 'CANCELLED', resolvedAt: new Date() }, { new: true, session },
    );
    if (request) await resolveNotification(request, session);
    return result('Takip isteği geri çekildi.', requester.following.some(id => String(id) === String(recipientId)) ? 'FOLLOWING' : 'NOT_FOLLOWING', request);
  });
}

async function resolveNotification(request, session) {
  await Notification.updateMany({ type: 'FOLLOW_REQUEST', 'meta.followRequestId': request._id },
    { $set: { isRead: true, 'meta.status': request.status } }, { session });
}

export async function respondToFollowRequest(recipientId, requestId, accept) {
  return transaction(async session => {
    const request = await FollowRequest.findOne({ _id: requestId, recipientId }).session(session);
    if (!request) throw new Error('Takip isteği bulunamadı veya bu isteği yanıtlama yetkiniz yok.');
    const { requester, recipient } = await pair(request.requesterId, recipientId, session);
    if (request.status !== 'PENDING') {
      if (request.status !== (accept ? 'ACCEPTED' : 'REJECTED')) throw new Error('Bu takip isteği artık onay beklemiyor.');
      return result('Bu takip isteği daha önce yanıtlandı.', requester.following.some(id => String(id) === String(recipientId)) ? 'FOLLOWING' : 'NOT_FOLLOWING', request);
    }
    request.status = accept ? 'ACCEPTED' : 'REJECTED';
    request.resolvedAt = new Date();
    await request.save({ session });
    await resolveNotification(request, session);
    if (!accept) return result('Takip isteği reddedildi.', 'NOT_FOLLOWING', request);
    await User.updateOne({ _id: requester._id }, { $addToSet: { following: recipient._id } }, { session });
    await User.updateOne({ _id: recipient._id }, { $addToSet: { followers: requester._id } }, { session });
    await Notification.create([{
      userId: requester._id, type: 'FOLLOW_REQUEST_ACCEPTED', title: 'Takip isteğin kabul edildi',
      message: `${recipient.username} takip isteğinizi kabul etti.`, icon: '✅', meta: { userId: recipient._id },
    }], { session });
    if (recipient.notificationSettings?.newFollower !== false) await Notification.create([{
      userId: recipient._id, type: 'NEW_FOLLOWER', title: 'Yeni takipçin var',
      message: `${requester.username} artık sizi takip ediyor.`, icon: '👤', meta: { userId: requester._id },
    }], { session });
    return result('Takip isteği kabul edildi.', 'FOLLOWING', request);
  });
}

export async function unfollowUser(requesterId, recipientId) {
  return transaction(async session => {
    await pair(requesterId, recipientId, session);
    await disconnectFollow(requesterId, recipientId, session);
    return result('Takip bırakıldı.', 'NOT_FOLLOWING');
  });
}

async function disconnectFollow(requesterId, recipientId, session) {
  await User.updateOne({ _id: requesterId }, { $pull: { following: recipientId } }, { session });
  await User.updateOne({ _id: recipientId }, { $pull: { followers: requesterId } }, { session });
  // An older pending request must not restore a deliberately removed follow.
  const requests = await FollowRequest.find({ requesterId, recipientId, status: 'PENDING' }).session(session);
  for (const request of requests) {
    request.status = 'CANCELLED'; request.resolvedAt = new Date();
    await request.save({ session }); await resolveNotification(request, session);
  }
}

export async function removeFollower(ownerId, followerId) {
  if (String(ownerId) === String(followerId)) throw new Error('Kendinizi takipçi listenizden çıkaramazsınız.');
  return transaction(async session => {
    const owner = await User.findOne({ _id: ownerId, ...active }).session(session);
    if (!owner) throw new Error('Kullanıcı bulunamadı.');
    // The owner comes from authentication, never from a client-supplied profile ID.
    // Also allow cleanup of an inactive or deleted follower's remaining references.
    await disconnectFollow(followerId, ownerId, session);
    return result('Kullanıcı takipçilerinizden çıkarıldı.', 'NOT_FOLLOWING');
  });
}

export async function getIncomingFollowRequests(recipientId, limit = 20, offset = 0) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('Geçersiz sayfa.');
  const filter = { recipientId, status: 'PENDING', requesterId: { $nin: await inactiveUserIds() } };
  const [items, total] = await Promise.all([
    FollowRequest.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).populate('requesterId'),
    FollowRequest.countDocuments(filter),
  ]);
  return { items, total };
}

export async function pendingFollowRequestCount(recipientId) {
  return FollowRequest.countDocuments({ recipientId, status: 'PENDING', requesterId: { $nin: await inactiveUserIds() } });
}
