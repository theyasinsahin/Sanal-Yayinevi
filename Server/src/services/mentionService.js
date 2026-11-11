import User from '../models/user.js';
import { notifyUser } from './notificationService.js';
import { literalSearch } from '../security/search.js';

export const MAX_MENTIONS = 30;

// Do not treat email addresses, URLs or a second @ as a mention.
export function mentionedUsernames(content = '') {
  const unique = new Set();
  for (const match of String(content || '').matchAll(/(^|[^\p{L}\p{N}_@./-])@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu)) {
    if (match[2].replace(/[.-]+$/, '').length <= 50) unique.add(match[2]);
    if (unique.size === MAX_MENTIONS) break;
  }
  return [...unique];
}

async function eligibleUsers(actorId, extra, limit = MAX_MENTIONS) {
  const actor = await User.findOne({ _id: actorId, isDeleted: false, isActive: { $ne: false } }).select('followers').lean();
  if (!actor) return [];
  return User.find({
    _id: { $ne: actorId }, isDeleted: false, isActive: { $ne: false },
    $and: [
      { $or: [{ 'privacySettings.isProfilePublic': { $ne: false } }, { _id: { $in: actor.followers || [] } }] },
      extra,
    ],
  }).select('username fullName profilePicture notificationSettings role').sort({ username: 1 }).limit(limit).lean();
}

export async function searchMentionUsers(actorId, query = '') {
  const pattern = literalSearch(query.replace(/^@/, ''));
  const users = await eligibleUsers(actorId, { $or: [
    { username: { $regex: `^${pattern}`, $options: 'i' } },
    { fullName: { $regex: pattern, $options: 'i' } },
  ] });
  return users.slice(0, 8).map(user => ({ id: String(user._id), username: user.username, fullName: user.fullName, profilePicture: user.profilePicture }));
}

export async function notifyMentions({ actorId, content, type = 'COMMENT_MENTION', message, meta, canAccess = () => true }) {
  const tokens = mentionedUsernames(content);
  const names = [...new Set(tokens.flatMap(name => [name, name.replace(/[.-]+$/, '')]))];
  if (!names.length) return new Set();
  const users = await eligibleUsers(actorId, { username: { $in: names.filter(name => name.length <= 50) } }, MAX_MENTIONS * 2);
  const byName = new Map(users.map(user => [user.username, user]));
  const recipients = new Map();
  for (const token of tokens) {
    const recipient = byName.get(token) || byName.get(token.replace(/[.-]+$/, ''));
    if (recipient) recipients.set(String(recipient._id), recipient);
  }
  const sent = new Set();
  for (const recipient of recipients.values()) {
    if (!await canAccess(recipient)) continue;
    const notice = await notifyUser(recipient._id, type === 'SESSION_MENTION' ? 'mentionInSession' : 'mentionInComment', {
      type, title: 'Etiketlendin', message, icon: '@', meta: { ...meta, actorId: String(actorId) },
    }, actorId);
    if (notice) sent.add(String(recipient._id));
  }
  return sent;
}
