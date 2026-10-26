import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import Comment from '../models/comment.js';
import Quote from '../models/quote.js';
import QuoteComment from '../models/quoteComment.js';
import ParagraphComment from '../models/paragraphComment.js';

export async function moderateVisibility(resource, record, removed, operationId, session) {
  if (!removed && resource.name !== 'Book') {
    if (record.bookId && await Book.exists({ _id: record.bookId, isDeleted: true }).session(session)) throw new Error('Önce bağlı kitabı arşivden çıkarın.');
    if (record.chapterId && await Chapter.exists({ _id: record.chapterId, isDeleted: true }).session(session)) throw new Error('Önce bağlı bölümü arşivden çıkarın.');
    if (record.quoteId && await Quote.exists({ _id: record.quoteId, isDeleted: true }).session(session)) throw new Error('Önce bağlı alıntıyı arşivden çıkarın.');
    if (record.parentId && await Comment.exists({ _id: record.parentId, isDeleted: true }).session(session)) throw new Error('Önce bağlı ana yorumu arşivden çıkarın.');
  }
  const targets = [];
  if (resource.name === 'Book') {
    const quotes = await Quote.find({ bookId: record._id }).select('_id').session(session).exec();
    targets.push([Chapter, { bookId: record._id }], [Comment, { bookId: record._id }], [ParagraphComment, { bookId: record._id }], [Quote, { bookId: record._id }], [QuoteComment, { quoteId: { $in: quotes.map(quote => quote._id) } }]);
  }
  if (resource.name === 'Chapter') {
    const quotes = await Quote.find({ chapterId: record._id }).select('_id').session(session).exec();
    targets.push([ParagraphComment, { chapterId: record._id }], [Quote, { chapterId: record._id }], [QuoteComment, { quoteId: { $in: quotes.map(quote => quote._id) } }]);
  }
  if (resource.name === 'Quote') {
    const reposts = await Quote.find({ originalQuoteId: record._id }).select('_id').session(session).exec();
    targets.push([Quote, { originalQuoteId: record._id }], [QuoteComment, { quoteId: { $in: [record._id, ...reposts.map(quote => quote._id)] } }]);
  }
  if (resource.name === 'Comment') {
    const visited = new Set([String(record._id)]); let frontier = [record._id]; const ids = [];
    while (frontier.length) {
      const replies = await Comment.find({ parentId: { $in: frontier } }).select('_id').session(session).exec();
      frontier = replies.filter(reply => !visited.has(String(reply._id))).map(reply => reply._id);
      frontier.forEach(id => visited.add(String(id))); ids.push(...frontier);
    }
    targets.push([Comment, { _id: { $in: ids } }]);
  }
  const date = new Date(), marker = record.adminArchiveId;
  for (const [model, filter] of targets) {
    if (removed) await model.updateMany({ ...filter, isDeleted: false }, { $set: { isDeleted: true, deletedAt: date, adminArchiveId: operationId } }, { session }).exec();
    else if (marker) await model.updateMany({ ...filter, isDeleted: true, adminArchiveId: marker }, { $set: { isDeleted: false, deletedAt: null }, $unset: { adminArchiveId: 1 } }, { session }).exec();
  }
  record.deletedAt = removed ? date : null;
  if (resource.model.schema.path('adminArchiveId')) record.adminArchiveId = removed ? operationId : undefined;
}
