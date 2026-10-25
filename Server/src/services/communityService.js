import { contactMessageEmail, newsletterConfirmationEmail } from '../emails/templates.js';
import { GraphQLError } from 'graphql';
import { randomBytes, createHash } from 'node:crypto';
import Book from '../models/book.js';
import User from '../models/user.js';
import Subscription from '../models/newsletterSubscription.js';
import mailer, { contactRecipient } from '../config/smtp.js';

export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hash = token => createHash('sha256').update(token).digest('hex');
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

const attempts = new Map();
// Bounded, per-process protection; deployments with replicas also need an edge limit.
export function rateLimit(req) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = req?.ip || 'unknown';
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
  if (attempts.size >= 10000 && !attempts.has(key)) throw new GraphQLError('Lütfen daha sonra tekrar deneyin.', { extensions: { code: 'TOO_MANY_REQUESTS' } });
  attempts.set(key, entry);
  if (++entry.count > 10) throw new GraphQLError('Çok fazla istek. Lütfen daha sonra tekrar deneyin.', { extensions: { code: 'TOO_MANY_REQUESTS' } });

}
function requireMail() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new Error('E-posta hizmeti yapılandırılmamış.');
}
function clientUrl() {
  const url = new URL(process.env.CLIENT_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Geçersiz uygulama adresi.');
  return url.origin;
}
export const authorPipeline = (page, pageSize) => [
  { $match: { isDeleted: false, status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] } } },
  { $group: { _id: '$authorId', bookCount: { $sum: 1 }, pageCount: { $sum: { $ifNull: ['$pageCount', 0] } } } },
  { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'author' } },
  { $unwind: '$author' },
  { $match: { 'author.isDeleted': false, 'author.isActive': { $ne: false }, 'author.privacySettings.isProfilePublic': { $ne: false } } },
  { $sort: { 'author.username': 1, _id: 1 } },
  { $facet: { total: [{ $count: 'count' }], authors: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }, { $project: { _id: 0, id: '$_id', bookCount: 1, pageCount: 1, username: '$author.username', fullName: '$author.fullName', bio: '$author.bio', profilePicture: '$author.profilePicture' } }] } },
];
export async function getAuthors({ page = 1, pageSize = 12 } = {}) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new GraphQLError('Geçersiz sayfa.', { extensions: { code: 'BAD_USER_INPUT' } });
  const [result] = await Book.aggregate(authorPipeline(page, pageSize));
  const total = result.total[0]?.count || 0;
  return { authors: result.authors, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
export function getCommunityConfig() {
  const socials = {};
  for (const name of ['instagram', 'x', 'linkedin', 'tiktok']) {
    try {
      const url = new URL(process.env[`SOCIAL_${name.toUpperCase()}_URL`]);
      const hosts = { instagram: ['instagram.com', 'www.instagram.com'], x: ['x.com', 'www.x.com'], linkedin: ['linkedin.com', 'www.linkedin.com'], tiktok: ['tiktok.com', 'www.tiktok.com'] };
      if (url.protocol === 'https:' && hosts[name].includes(url.hostname) && !url.username && !url.password) socials[name] = url.href;
    } catch { /* Unconfigured profiles are omitted. */ }
  }
  return { email: validEmail(process.env.CONTACT_EMAIL) ? process.env.CONTACT_EMAIL : '', phone: process.env.CONTACT_PHONE || '', socials };
}
export async function sendContactMessage({ name, email, subject, message, website }, req) {
  rateLimit(req);
  if (website || !text(name, 2, 100) || !validEmail(email) || !text(subject, 3, 150) || !text(message, 10, 5000)) throw new GraphQLError('Lütfen form alanlarını kontrol edin.', { extensions: { code: 'BAD_USER_INPUT' } });
  requireMail();
  const result = await mailer.sendMail({ from: { name: 'Betik', address: process.env.EMAIL_USER }, to: contactRecipient(), replyTo: email, ...contactMessageEmail({ name: name.trim(), email, subject: subject.trim(), message: message.trim() }) });
  if (!result.accepted?.length) throw new Error('E-posta gönderimi kabul edilmedi.');
  return { message: 'Mesajınız e-posta servisine iletildi.' };
}
export async function subscribeNewsletter({ email, consent, website }, req) {
  rateLimit(req);
  if (!validEmail(email) || consent !== true || website) throw new GraphQLError('Geçerli e-posta ve abonelik onayı gereklidir.', { extensions: { code: 'BAD_USER_INPUT' } });
  requireMail();
  const origin = clientUrl();
  const normalized = email.trim().toLowerCase();
  const existing = await Subscription.findOne({ email: normalized });
  const response = { message: 'Adresiniz zaten kayıtlıysa aboneliğiniz korunur; aksi halde doğrulama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.' };
  if (existing?.status === 'active' || (existing?.requestedAt && Date.now() - existing.requestedAt.getTime() < 60_000)) return response;
  const token = randomBytes(32).toString('hex');
  let subscription;
  try {
    subscription = await Subscription.findOneAndUpdate({ email: normalized, status: { $ne: 'active' } }, { $set: { status: 'pending', tokenHash: hash(token), tokenExpiresAt: new Date(Date.now() + 86400_000), requestedAt: new Date(), consentVersion: '2026-10-23' } }, { upsert: true, new: true });
  } catch (error) { if (error.code === 11000) return response; throw error; }
  try {
    const result = await mailer.sendMail({ from: { name: 'Betik', address: process.env.EMAIL_USER }, to: normalized, ...newsletterConfirmationEmail({ confirmUrl: `${origin}/newsletter?token=${token}&action=confirm`, unsubscribeUrl: `${origin}/newsletter?token=${token}&action=unsubscribe` }) });
    if (!result.accepted?.length) throw new Error('E-posta gönderimi kabul edilmedi.');
  } catch (error) {
    await Subscription.updateOne({ _id: subscription._id, tokenHash: hash(token) }, { $unset: { requestedAt: 1, tokenHash: 1, tokenExpiresAt: 1 } });
    throw error;
  }
  return response;
}
export async function manageNewsletter({ token, action }, req) {
  rateLimit(req);
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !['confirm', 'unsubscribe'].includes(action)) throw new GraphQLError('Geçersiz bağlantı.', { extensions: { code: 'BAD_USER_INPUT' } });
  const filter = { tokenHash: hash(token) };
  if (action === 'confirm') Object.assign(filter, { status: 'pending', tokenExpiresAt: { $gt: new Date() } });
  const update = action === 'confirm' ? { status: 'active', confirmedAt: new Date() } : { status: 'unsubscribed', unsubscribedAt: new Date() };
  const result = await Subscription.findOneAndUpdate(filter, { $set: update }, { new: true });
  if (!result) throw new GraphQLError('Bağlantı geçersiz veya süresi dolmuş. Yeniden abone olabilirsiniz.', { extensions: { code: 'BAD_USER_INPUT' } });
  return { message: action === 'confirm' ? 'Aboneliğiniz doğrulandı. İptal bağlantısını içeren e-postayı saklayın.' : 'Aboneliğiniz iptal edildi.' };
}
