import { FundingCampaign } from '../models/printFunding.js';

export const isPublishedDigitalBook = book => book.kind !== 'PRINTED' && !book.isDeleted &&
  (book.digitalStatus ? book.digitalStatus === 'PUBLISHED' : ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'].includes(book.status));

export function fundingSummary(campaign, now = new Date()) {
  if (!campaign) return null;
  const remainingMinor = Math.max(0, campaign.targetMinor - campaign.acceptedMinor);
  const goalReached = campaign.targetMinor > 0 && remainingMinor === 0 && !campaign.financeIssue &&
    (['ACTIVE', 'SUCCEEDED'].includes(campaign.state) || (campaign.state === 'CLOSING' && campaign.outcome === 'TARGET'));
  return {
    id: String(campaign._id), state: campaign.state, environment: campaign.environment,
    targetMinor: campaign.targetMinor, acceptedMinor: campaign.acceptedMinor, remainingMinor,
    progressPercent: campaign.targetMinor > 0 ? Math.min(100, campaign.acceptedMinor * 100 / campaign.targetMinor) : 0,
    isOpen: campaign.state === 'ACTIVE' && new Date(campaign.startsAt) <= now && new Date(campaign.endsAt) > now &&
      remainingMinor > 0 && campaign.targetMinor > 0 && !campaign.financeIssue,
    goalReached, endsAt: campaign.endsAt,
  };
}

// Shared projection keeps payment/application details out of card reads.
export const campaignCardProjection = {
  bookId: 1, state: 1, environment: 1, targetMinor: 1, acceptedMinor: 1,
  startsAt: 1, endsAt: 1, outcome: 1, financeIssue: 1,
};

export async function latestBookCampaigns(ids) {
  const records = await FundingCampaign.aggregate([
    { $match: { bookId: { $in: ids.map(id => new FundingCampaign.base.Types.ObjectId(String(id))) } } },
    { $sort: { bookId: 1, createdAt: -1, _id: -1 } },
    { $group: { _id: '$bookId', campaign: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$campaign' } },
    { $project: campaignCardProjection },
  ]).exec();
  const map = new Map(records.map(record => [String(record.bookId), record]));
  return ids.map(id => map.get(String(id)) || null);
}

// The latest campaign must be chosen before applying state filters, so an old
// successful campaign cannot override a newer failed/refunded campaign.
export const latestCampaignLookup = () => [
  { $lookup: { from: FundingCampaign.collection.name, localField: '_id', foreignField: 'bookId', pipeline: [
    { $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 }, { $project: campaignCardProjection },
  ], as: '_campaigns' } },
  { $set: { _fundingCampaign: { $arrayElemAt: ['$_campaigns', 0] } } },
];

export function campaignCatalogMatch(funding, now) {
  const root = '_fundingCampaign';
  if (funding === 'ACTIVE') return {
    [`${root}.state`]: 'ACTIVE', [`${root}.startsAt`]: { $lte: now }, [`${root}.endsAt`]: { $gt: now },
    [`${root}.targetMinor`]: { $gt: 0 }, [`${root}.financeIssue`]: { $in: ['', null] },
    $expr: { $lt: [`$${root}.acceptedMinor`, `$${root}.targetMinor`] },
  };
  return {
    [`${root}.targetMinor`]: { $gt: 0 }, [`${root}.financeIssue`]: { $in: ['', null] },
    $expr: { $gte: [`$${root}.acceptedMinor`, `$${root}.targetMinor`] },
    $or: [{ [`${root}.state`]: { $in: ['ACTIVE', 'SUCCEEDED'] } }, { [`${root}.state`]: 'CLOSING', [`${root}.outcome`]: 'TARGET' }],
  };
}
