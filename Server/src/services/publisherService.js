import { GraphQLError } from 'graphql';
import User from '../models/user.js';
import Book from '../models/book.js';
import { FundingCampaign } from '../models/printFunding.js';

const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function requirePublisher(context) {
  const id = context.user?._id || context.user?.id;
  if (!id) throw fail('Yayınevi portalı için giriş yapmalısınız.', 'UNAUTHENTICATED');
  const actor = await User.findOne({ _id: id, isDeleted: false, isActive: { $ne: false }, role: { $in: ['PUBLISHER', 'ADMIN'] } }).select('_id').lean().exec();
  if (!actor) throw fail('Aktif yayınevi sahibi veya yönetici yetkisi gerekli.', 'FORBIDDEN');
  return actor;
}

// A dedicated read model deliberately exposes neither Book/User resolvers nor
// private applications, quotes, payment records, addresses or campaign operations.
export async function publisherCatalog(context, { page = 1, limit = 20, search = '', funding = 'ALL' } = {}) {
  await requirePublisher(context);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 48) throw fail('Geçerli bir sayfa ve liste boyutu seçin.');
  if (typeof search !== 'string' || search.length > 100 || !['ALL', 'HAS_CAMPAIGN', 'ACTIVE', 'SUCCEEDED'].includes(funding)) throw fail('Geçerli bir arama ve destek filtresi seçin.');
  const term = search.trim();
  const pipeline = [
    { $match: { kind: { $ne: 'PRINTED' }, isDeleted: false, $or: [
      { digitalStatus: 'PUBLISHED' },
      { digitalStatus: null, status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] } },
    ] } },
    { $project: { title: 1, urlSlug: 1, imageUrl: 1, publishDate: 1, writingStatus: 1, status: 1, authorId: 1 } },
    { $lookup: { from: User.collection.name, localField: 'authorId', foreignField: '_id', pipeline: [
      { $match: { isDeleted: false, isActive: { $ne: false } } },
      { $project: { fullName: 1, username: 1 } },
    ], as: 'author' } },
    { $unwind: '$author' },
  ];
  if (term) {
    const expression = new RegExp(escape(term).replace(/[iİıI]/g, '[iİıI]'), 'i');
    pipeline.push({ $match: { $or: [{ title: expression }, { 'author.fullName': expression }, { 'author.username': expression }] } });
  }
  const campaignStages = [
    { $lookup: { from: FundingCampaign.collection.name, localField: '_id', foreignField: 'bookId', pipeline: [
      { $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 },
      { $project: { state: 1, environment: 1, targetMinor: 1, acceptedMinor: 1, supporterCount: 1, endsAt: 1, updatedAt: 1 } },
    ], as: 'campaigns' } },
    { $set: { campaign: { $ifNull: [{ $arrayElemAt: ['$campaigns', 0] }, null] } } },
  ];
  // For an unfiltered catalog, join only the requested page's campaigns.
  if (funding !== 'ALL') pipeline.push(...campaignStages);
  if (funding === 'HAS_CAMPAIGN') pipeline.push({ $match: { campaign: { $ne: null } } });
  if (funding === 'ACTIVE') pipeline.push({ $match: { 'campaign.state': 'ACTIVE', 'campaign.endsAt': { $gt: new Date() } } });
  if (funding === 'SUCCEEDED') pipeline.push({ $match: { 'campaign.state': 'SUCCEEDED' } });
  pipeline.push({ $facet: {
    count: [{ $count: 'total' }],
    items: [
      { $sort: { publishDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
      ...(funding === 'ALL' ? campaignStages : []),
      { $project: { _id: 1, urlSlug: 1, title: 1, imageUrl: 1, publishDate: 1, writingStatus: 1, status: 1, author: 1, campaign: 1 } },
    ],
  } });
  const [result] = await Book.aggregate(pipeline).exec();
  const total = result.count[0]?.total || 0;
  const items = result.items.map(book => ({
    id: String(book._id), urlSlug: book.urlSlug || null, title: book.title, imageUrl: book.imageUrl || '',
    authorName: book.author.fullName || book.author.username, publishDate: book.publishDate,
    writingStatus: book.writingStatus || (['COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'].includes(book.status) ? 'COMPLETED' : 'WRITING'),
    campaign: book.campaign && {
      id: String(book.campaign._id), state: book.campaign.state, environment: book.campaign.environment,
      targetMinor: book.campaign.targetMinor, acceptedMinor: book.campaign.acceptedMinor,
      supporterCount: book.campaign.supporterCount, endsAt: book.campaign.endsAt, updatedAt: book.campaign.updatedAt,
    },
  }));
  return { items, total, page, totalPages: Math.ceil(total / limit), refreshedAt: new Date() };
}
