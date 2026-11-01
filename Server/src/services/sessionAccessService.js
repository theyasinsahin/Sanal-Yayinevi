import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import User from '../models/user.js';
import AdminAudit from '../models/adminAudit.js';
import { requireAdmin } from '../utils/adminAccess.js';

const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
const active = { isDeleted: false, isActive: { $ne: false } };
const fields = 'username fullName email sessionCreationAccess';
const view = user => {
  const access = user.sessionCreationAccess || {};
  return { user, status: access.status || 'NONE', reason: access.reason || '', reviewNote: access.reviewNote || '',
    requestedAt: access.requestedAt?.toISOString() || null, reviewedAt: access.reviewedAt?.toISOString() || null,
    revision: access.revision || 0 };
};
async function member(context) {
  const id = context.user?._id || context.user?.id;
  const user = id && await User.findOne({ _id: id, ...active }).select(fields).exec();
  if (!user) throw fail('Giriş yapmalısınız.', 'UNAUTHENTICATED');
  return user;
}

export async function getMySessionAccess(context) {
  return view(await member(context));
}

export async function requestSessionAccess(context, reason) {
  const user = await member(context);
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 1000) throw fail('Başvuru açıklaması 10–1000 karakter olmalı.');
  const updated = await User.findOneAndUpdate({ _id: user._id, ...active,
    $or: [{ 'sessionCreationAccess.status': { $exists: false } }, { 'sessionCreationAccess.status': { $in: ['NONE', 'REJECTED'] } }] },
  { $set: { 'sessionCreationAccess.status': 'PENDING', 'sessionCreationAccess.reason': reason.trim(),
    'sessionCreationAccess.requestedAt': new Date(), 'sessionCreationAccess.reviewedAt': null,
    'sessionCreationAccess.reviewedBy': null, 'sessionCreationAccess.reviewNote': '' }, $inc: { 'sessionCreationAccess.revision': 1 } },
  { new: true, runValidators: true }).select(fields).exec();
  // Concurrent/duplicate requests return the one current request, never replace it.
  return view(updated || await member(context));
}

export async function getSessionAccessRequests(context, { status = 'PENDING', page = 1 } = {}) {
  await requireAdmin(context);
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status) || !Number.isInteger(page) || page < 1 || page > 10000) throw fail('Geçerli bir durum ve sayfa seçin.');
  const filter = { ...active, 'sessionCreationAccess.status': status };
  const [users, total] = await Promise.all([
    User.find(filter).select(fields).sort({ 'sessionCreationAccess.requestedAt': -1, _id: -1 }).skip((page - 1) * 20).limit(20).exec(),
    User.countDocuments(filter).exec(),
  ]);
  return { items: users.map(view), total, page, totalPages: Math.ceil(total / 20) };
}

export async function reviewSessionAccess(context, { userId, revision, approve, note = '' }) {
  if (!mongoose.isObjectIdOrHexString(userId) || !Number.isInteger(revision) || revision < 1 || typeof approve !== 'boolean') throw fail('Geçerli bir başvuru seçin.');
  if (typeof note !== 'string' || note.trim().length > 500 || (!approve && note.trim().length < 5)) throw fail('Ret veya izin kaldırma gerekçesi 5–500 karakter olmalı.');
  await AdminAudit.init();
  return mongoose.connection.transaction(async session => {
    const admin = await requireAdmin(context, session);
    const user = await User.findOneAndUpdate({ _id: userId, ...active,
      'sessionCreationAccess.revision': revision,
      'sessionCreationAccess.status': { $in: approve ? ['PENDING'] : ['PENDING', 'APPROVED'] } },
    { $set: { 'sessionCreationAccess.status': approve ? 'APPROVED' : 'REJECTED',
      'sessionCreationAccess.reviewNote': note.trim(), 'sessionCreationAccess.reviewedBy': admin._id,
      'sessionCreationAccess.reviewedAt': new Date() }, $inc: { 'sessionCreationAccess.revision': 1 } },
    { new: false, runValidators: true, session }).select(fields).exec();
    if (!user) throw fail('Başvuru değişmiş veya hesap kapatılmış. Listeyi yenileyip tekrar inceleyin.', 'CONFLICT');
    await AdminAudit.create([{ actorId: admin._id, resource: 'User', recordId: userId,
      action: approve ? 'SESSION_ACCESS_APPROVE' : user.sessionCreationAccess.status === 'APPROVED' ? 'SESSION_ACCESS_REVOKE' : 'SESSION_ACCESS_REJECT',
      reason: note.trim() || 'Oturum oluşturma izni onaylandı.', fields: ['sessionCreationAccess'] }], { session });
    const updated = await User.findById(userId).select(fields).session(session).exec();
    return view(updated);
  });
}
