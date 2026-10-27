import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import PrintedBookReading from '../models/printedBookReading.js';
import Book from '../models/book.js';
import User from '../models/user.js';
import { canViewLibrary } from '../utils/profileAccess.js';

const active = { isDeleted: false, isActive: { $ne: false } };
const publicBook = { kind: 'PRINTED', publicationStatus: 'APPROVED', isDeleted: false };
const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
function objectId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw fail('Geçerli bir kitap veya kullanıcı seçin.');
  return new mongoose.Types.ObjectId(String(value));
}
async function member(context) {
  const id = context.user?._id || context.user?.id;
  const user = id && await User.findOne({ _id: id, ...active }).exec();
  if (!user) throw fail('Giriş yapmalısınız.', 'UNAUTHENTICATED');
  return user;
}

export async function myPrintedReading(context, bookId) {
  const user = await member(context);
  const book = await Book.findOne({ _id: objectId(bookId), ...publicBook }).exec();
  if (!book) return null;
  return PrintedBookReading.findOne({ userId: user._id, bookId: book._id, isDeleted: false }).exec();
}

export async function savePrintedReading(context, { bookId, rating, review = '' }) {
  const user = await member(context);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail('Puan 1–5 arasında tam sayı olmalı.');
  if (typeof review !== 'string' || review.trim().length > 3000) throw fail('Yorum en fazla 3000 karakter olmalı.');
  const book = await Book.findOne({ _id: objectId(bookId), ...publicBook }).select('_id').exec();
  if (!book) throw fail('Yalnızca onaylanmış basılı kitapları okuduklarınıza ekleyebilirsiniz.');
  await PrintedBookReading.init();
  const filter = { userId: user._id, bookId: book._id, adminArchiveId: { $exists: false } };
  const update = { $set: { rating, review: review.trim(), isDeleted: false, deletedAt: null },
    $setOnInsert: { readAt: new Date() } };
  try {
    return await PrintedBookReading.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true }).exec();
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A simultaneous first save may win the unique index race. Update that row.
    const saved = await PrintedBookReading.findOneAndUpdate(filter, update, { new: true, runValidators: true }).exec();
    if (!saved) throw fail('Bu değerlendirme yönetim tarafından kaldırıldı.', 'FORBIDDEN');
    return saved;
  }
}

export async function removePrintedReading(context, bookId) {
  const user = await member(context);
  // Removal is possible even if the book was subsequently archived.
  await PrintedBookReading.updateOne({ userId: user._id, bookId: objectId(bookId), isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date() } }).exec();
  return true;
}

export async function getPrintedReadings(context, { userId, page = 1 }) {
  const id = objectId(userId);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw fail('Geçerli bir sayfa seçin.');
  const profile = await User.findOne({ _id: id, ...active }).exec();
  // Refresh the viewer too: stale caller data cannot retain a revoked follower relation.
  const viewerId = context.user?._id || context.user?.id;
  const viewer = viewerId ? await User.findOne({ _id: viewerId, ...active }).exec() : null;
  if (!profile || !canViewLibrary(profile, viewer)) return { items: [], total: 0, totalPages: 0, page, canView: false };
  const [result] = await PrintedBookReading.aggregate([
    { $match: { userId: id, isDeleted: false } },
    { $sort: { readAt: -1, _id: -1 } },
    { $lookup: { from: Book.collection.name, localField: 'bookId', foreignField: '_id', pipeline: [{ $match: publicBook }], as: 'book' } },
    { $unwind: '$book' },
    { $facet: { items: [{ $skip: (page - 1) * 12 }, { $limit: 12 }], count: [{ $count: 'total' }] } },
  ]).exec();
  const total = result?.count[0]?.total || 0;
  return { items: result?.items || [], total, totalPages: Math.ceil(total / 12), page, canView: true };
}
