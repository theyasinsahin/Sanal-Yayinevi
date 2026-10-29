import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import User from '../../models/user.js';
import { PrintAudit, PrintOutbox, PrintTariff, PrintApplication, BookPrintVersion, FundingCampaign, CampaignUpdate, printModels } from '../../models/printFunding.js';
import Notification from '../../models/notification.js';

export const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
export function id(value, field = 'id', message = 'Geçerli bir kayıt kimliği gerekli.') {
  if (!mongoose.isObjectIdOrHexString(value)) throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', field } });
  return value;
}
export function int(value, label, min = 0, max = 100000000000) { if (!Number.isSafeInteger(value) || value < min || value > max) throw fail(`${label}: ${min}–${max} arası tam sayı gerekli.`); return value; }
export function text(value, label, min = 1, max = 2000) { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(`${label}: ${min}–${max} karakter gerekli.`); return value.trim(); }
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' && !(value instanceof Date) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const hash = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest('hex');
export async function actor(context, session = null, admin = false) {
  const userId = context.user?._id || context.user?.id;
  const user = userId && await User.findOne({ _id: id(userId, 'userId', 'Oturum kullanıcı kimliği geçersiz. Yeniden giriş yapın.'), isDeleted: false, isActive: { $ne: false }, ...(admin ? { role: 'ADMIN' } : {}) }).session(session).exec();
  if (!user) throw fail(admin ? 'Aktif yönetici yetkisi gerekli.' : 'Giriş yapmalısınız.', admin ? 'FORBIDDEN' : 'UNAUTHENTICATED');
  return user;
}
export function owner(record, user) { if (String(record.authorId) !== String(user._id)) throw fail('Bu kitap için yazar yetkisi gerekli.', 'FORBIDDEN'); }
export const audit = (session, actorId, entityId, action, from, to, reason = '', metadata = {}) => PrintAudit.create([{ actorId, entityId, action, from, to, reason, metadata }], { session });
export async function notice(session, key, userId, title, message, campaignId = null, broadcast = false) {
  await PrintOutbox.updateOne({ key }, { $setOnInsert: { key, userId, title, message, campaignId, broadcast } }, { upsert: true, session }).exec();
}
export const transact = fn => mongoose.connection.transaction(fn, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 15000 });
export function assertPrintSystem() { if (process.env.PRINT_SYSTEM_ENABLED !== 'true') throw fail('Basım sistemi kapalı. Test ortamında PRINT_SYSTEM_ENABLED=true ile etkinleştirin.', 'PRINT_SYSTEM_DISABLED'); }
async function requireTransactions() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw fail('Başvuru, tarife ve işlem geçmişini birlikte kaydetmek için MongoDB replica set veya mongos gerekli.', 'PRINT_STORAGE_UNAVAILABLE');
}
export async function initializePrintTariffManagement() {
  // The global print feature may be disabled at startup. Prepare only admin tariff
  // indexes here, before the transaction; no worker, payment or campaign is enabled.
  await requireTransactions();
  await Promise.all([PrintTariff.createIndexes(), PrintAudit.createIndexes()]);
}
export async function initializePrintApplicationManagement() {
  // Application preparation/review is available independently of financial features.
  // Create required unique indexes before entering a transaction, also when startup
  // funding initialization was skipped. Never create campaigns or provider records.
  await requireTransactions();
  await Promise.all([PrintApplication, BookPrintVersion, PrintAudit, PrintOutbox, Notification].map(model => model.createIndexes()));
}
export async function initializePrintFunding() {
  // No index drops or legacy-data writes. Fail closed on standalone MongoDB.
  await requireTransactions();
  await Promise.all(printModels.map(model => model.createIndexes()));
}
export async function initializePrintCampaignManagement() {
  await requireTransactions();
  // Campaign locks and management history are required even with payments off.
  // Do not initialize a provider or enable financial processing here.
  await Promise.all([FundingCampaign, PrintApplication, CampaignUpdate, PrintAudit, PrintOutbox, Notification].map(model => model.createIndexes()));
}
export function page(value = 1) { return int(value, 'Sayfa', 1, 10000); }
