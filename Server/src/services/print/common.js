import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import User from '../../models/user.js';
import { PrintAudit, PrintOutbox, printModels } from '../../models/printFunding.js';

export const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
export function id(value) { if (!mongoose.isObjectIdOrHexString(value)) throw fail('Geçerli bir kayıt kimliği gerekli.'); return value; }
export function int(value, label, min = 0, max = 100000000000) { if (!Number.isSafeInteger(value) || value < min || value > max) throw fail(`${label}: ${min}–${max} arası tam sayı gerekli.`); return value; }
export function text(value, label, min = 1, max = 2000) { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(`${label}: ${min}–${max} karakter gerekli.`); return value.trim(); }
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' && !(value instanceof Date) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const hash = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest('hex');
export async function actor(context, session = null, admin = false) {
  const userId = context.user?._id || context.user?.id;
  const user = userId && await User.findOne({ _id: id(userId), isDeleted: false, isActive: { $ne: false }, ...(admin ? { role: 'ADMIN' } : {}) }).session(session).exec();
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
export async function initializePrintFunding() {
  // No index drops or legacy-data writes. Fail closed on standalone MongoDB.
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Basım sistemi MongoDB replica set veya mongos gerektirir.');
  await Promise.all(printModels.map(model => model.createIndexes()));
}
export function page(value = 1) { return int(value, 'Sayfa', 1, 10000); }
