import User from '../models/user.js';
import Notification from '../models/notification.js';
import { FundingCampaign, PrintApplication } from '../models/printFunding.js';

// Resolve both new and previously delivered print notices without rewriting the inbox.
export async function resolvePrintNotificationTargets(notifications) {
  const pending = notifications.filter(item => item.type === 'PRINT_UPDATE' && !item.meta?.bookId);
  const applicationId = item => item.dedupKey?.match(/^print:(?:submitted|review):([a-f\d]{24}):/i)?.[1];
  const campaignIds = pending.map(item => String(item.meta?.campaignId || '')).filter(value => /^[a-f\d]{24}$/i.test(value));
  const applicationIds = pending.map(applicationId).filter(Boolean);
  const [campaigns, applications] = await Promise.all([
    campaignIds.length ? FundingCampaign.find({ _id: { $in: campaignIds } }).select('bookId authorId').lean() : [],
    applicationIds.length ? PrintApplication.find({ _id: { $in: applicationIds } }).select('bookId authorId').lean() : [],
  ]);
  const sources = new Map([...campaigns, ...applications].map(source => [String(source._id), source]));
  for (const item of pending) {
    const source = sources.get(String(item.meta?.campaignId || applicationId(item) || ''));
    if (source) item.meta = { ...item.meta, bookId: String(source.bookId), authorId: String(source.authorId) };
  }
  return notifications;
}

export async function notifyUser(userId, preference, notification, actorId) {
  if (!userId || String(userId) === String(actorId)) return null;
  const user = await User.findOne({ _id: userId, isDeleted: false, isActive: { $ne: false } });
  if (!user || user.notificationSettings?.[preference] === false) return null;
  return Notification.create({ userId, ...notification });
}
