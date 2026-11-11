import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import SecurityRateBucket from '../models/securityRateBucket.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const keyFor = (scope, identity, windowMs, now) => digest(`${scope}:${identity}:${Math.floor(now / windowMs)}`);
export const rateError = () => new GraphQLError('Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.', { extensions: { code: 'RATE_LIMITED', http: { status: 429 } } });

// Shared, atomic fixed windows across workers. The window is part of the key:
// correctness does not depend on the asynchronous MongoDB TTL monitor.
export async function consumeRate(scope, identity, limit, windowMs, now = Date.now()) {
  const window = Math.floor(now / windowMs);
  const _id = keyFor(scope, identity, windowMs, now);
  let bucket;
  try {
    bucket = await SecurityRateBucket.findOneAndUpdate({ _id }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * windowMs) },
    }, { upsert: true, new: true }).lean().exec();
  } catch (error) {
    if (error.code !== 11000) throw error; // Store outage fails closed.
    bucket = await SecurityRateBucket.findOneAndUpdate({ _id }, { $inc: { count: 1 } }, { new: true }).lean().exec();
  }
  if (!bucket || bucket.count > limit) throw rateError();
}

export async function checkRate(scope, identity, limit, windowMs, now = Date.now()) {
  const bucket = await SecurityRateBucket.findById(keyFor(scope, identity, windowMs, now)).select('count').lean().exec();
  if (bucket && bucket.count >= limit) throw rateError();
}

const policies = {
  login: [20, 15 * 60000, 10], googleAuth: [20, 15 * 60000],
  sendRegistrationCode: [5, 15 * 60000, 3], register: [15, 15 * 60000, 5],
  forgotPassword: [5, 15 * 60000, 3], resetPassword: [10, 15 * 60000],
  changePassword: [10, 15 * 60000], changeEmail: [10, 15 * 60000],
  verifySessionAccessCode: [10, 15 * 60000],
  startPrintCheckout: [15, 60000], runPrintMaintenance: [2, 60000],
};
export async function limitOperation(context, name, args, mutation) {
  if (name === 'registerAndLogin') name = 'register';
  const req = context.req || context.socketRequest;
  if (!req) return; // In-process service calls have no remote caller.
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  await consumeRate('api', ip, 600, 60000);
  const policy = policies[name];
  if (policy) {
    const [limit, windowMs, accountLimit] = policy;
    await consumeRate(`operation:${name}`, ip, limit, windowMs);
    if (accountLimit) await consumeRate(`account:${name}`, String(args.email || '').trim().toLowerCase(), accountLimit, windowMs);
  } else if (mutation) await consumeRate('mutation', context.user?.id || ip, 120, 60000);
}
