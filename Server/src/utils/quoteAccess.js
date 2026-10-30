import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import Quote from '../models/quote.js';
import User from '../models/user.js';

// Missing visibility belongs to quotes created before this feature. Unknown
// values are not public. Private quotes have no administrator/follower bypass.
export const publicQuoteFilter = () => ({ $or: [{ visibility: 'PUBLIC' }, { visibility: { $exists: false } }] });
export const isPublicQuote = quote => quote && (quote.visibility === 'PUBLIC' || quote.visibility === undefined);
export const quoteOwnerId = viewer => viewer?._id ?? viewer?.id;
export const canReadQuote = (quote, viewer) => Boolean(quote && (isPublicQuote(quote)
  || (quote.visibility === 'PRIVATE' && quoteOwnerId(viewer) && String(quote.userId?._id ?? quote.userId) === String(quoteOwnerId(viewer)))));
export const quoteVisibilityFilter = viewer => quoteOwnerId(viewer)
  ? { $or: [...publicQuoteFilter().$or, { visibility: 'PRIVATE', userId: quoteOwnerId(viewer) }] }
  : publicQuoteFilter();
export const quoteUnavailable = () => new GraphQLError('Alıntı bulunamadı veya erişim izniniz yok.', { extensions: { code: 'NOT_FOUND' } });

export async function requireQuote(id, viewer, { publicOnly = false } = {}) {
  if (!mongoose.isObjectIdOrHexString(id)) throw quoteUnavailable();
  const quote = await Quote.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!quote || !(publicOnly ? isPublicQuote(quote) : canReadQuote(quote, viewer))) throw quoteUnavailable();
  if (!await User.exists({ _id: quote.userId, isDeleted: false, isActive: { $ne: false } })) throw quoteUnavailable();
  if (quote.isRepost) {
    const original = await Quote.findOne({ _id: quote.originalQuoteId, isDeleted: { $ne: true }, ...publicQuoteFilter() });
    if (!original || !await User.exists({ _id: original.userId, isDeleted: false, isActive: { $ne: false } })) throw quoteUnavailable();
  }
  return quote;
}
