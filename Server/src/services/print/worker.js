import mongoose from 'mongoose';
import User from '../../models/user.js';
import Notification from '../../models/notification.js';
import { FundingCampaign, FundingPayment, FundingRefund, PaymentReservation, PrintOutbox, CampaignSupporter } from '../../models/printFunding.js';
import { sandboxEnabled, getPaymentProvider } from './paymentProvider.js';
import { reconcilePayment, processRefund } from './paymentService.js';
import { expireReservation, settleCampaign } from './campaignService.js';

async function deliver(outbox, userId) {
  const user = await User.findOne({ _id: userId, isDeleted: false, isActive: { $ne: false } }).select('notificationSettings').lean().exec();
  if (!user || user.notificationSettings?.offerUpdate === false) return;
  const dedupKey = `print:${outbox.key}:${userId}`;
  try { await Notification.updateOne({ dedupKey }, { $setOnInsert: { dedupKey, userId, type: 'PRINT_UPDATE', title: outbox.title, message: outbox.message, icon: '📖', meta: { campaignId: outbox.campaignId, environment: 'SANDBOX' } } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
}
export async function drainPrintOutbox() {
  const jobs = await PrintOutbox.find({ state: 'PENDING' }).sort({ _id: 1 }).limit(50).exec();
  for (const job of jobs) {
    try {
      if (job.userId) await deliver(job, job.userId);
      if (job.broadcast) {
        const supporters = await CampaignSupporter.find({ campaignId: job.campaignId, ...(job.cursor ? { _id: { $gt: job.cursor } } : {}) }).sort({ _id: 1 }).limit(100).lean().exec();
        for (const supporter of supporters) await deliver(job, supporter.userId);
        if (supporters.length === 100) {
          // Monotonic cursor survives concurrent workers and retry after delivery failure.
          await PrintOutbox.updateOne({ _id: job._id }, { $max: { cursor: supporters[supporters.length - 1]._id } }); continue;
        }
      }
      await PrintOutbox.updateOne({ _id: job._id }, { $set: { state: 'DONE', lastError: '' } });
    } catch { await PrintOutbox.updateOne({ _id: job._id }, { $inc: { attempts: 1 }, $set: { lastError: 'NOTIFICATION_DELIVERY_FAILED' } }); }
  }
}
export async function runPrintMaintenance() {
  if (!sandboxEnabled()) {
    const now = new Date();
    const empty = await FundingCampaign.find({ environment: 'SANDBOX', acceptedMinor: 0, reservedMinor: 0, soldQuantity: 0, reservedQuantity: 0, financeIssue: '', $or: [{ state: 'ACTIVE', endsAt: { $lte: now } }, { state: 'CLOSING' }] }).sort({ updatedAt: 1 }).limit(50).select('_id').lean().exec();
    for (const campaign of empty) await settleCampaign(campaign._id, now, { unfundedOnly: true });
    await drainPrintOutbox(); return { disabled: true };
  }
  const errors = [];
  const safe = async (phase, fn) => { try { return await fn(); } catch { errors.push(phase); return null; } };
  const now = new Date();
  // Expiry releases capacity first. A later provider capture is fully refunded.
  const expired = await PaymentReservation.find({ state: 'HELD', expiresAt: { $lte: now } }).sort({ expiresAt: 1 }).limit(100).select('_id').lean().exec();
  for (const item of expired) await safe('RESERVATION', async () => { const reference = await expireReservation(item._id, now); if (reference) {
    const payment = await FundingPayment.findById(reference).select('provider').lean();
    await getPaymentProvider(payment?.provider).cancel(reference);
  } });
  // Prioritize unresolved checkouts so historical captures cannot starve new payments.
  const pending = await FundingPayment.find({ state: { $in: ['CREATED', 'PENDING'] } }).sort({ reconciledAt: 1, _id: 1 }).limit(100).select('_id state').lean().exec();
  const late = await FundingPayment.find({ state: { $in: ['FAILED', 'CANCELLED'] }, $or: [{ reconciledAt: { $exists: false } }, { reconciledAt: { $lte: new Date(now.getTime() - 60000) } }] }).sort({ reconciledAt: 1, _id: 1 }).limit(25).select('_id state').lean().exec();
  const payments = [...pending, ...late];
  for (const payment of payments) await safe('PAYMENT', async () => {
    if (payment.state === 'CANCELLED') {
      const record = await FundingPayment.findById(payment._id).select('provider').lean();
      await getPaymentProvider(record?.provider).cancel(String(payment._id));
    }
    return reconcilePayment(String(payment._id));
  });
  const campaigns = await FundingCampaign.find({ $or: [{ state: 'ACTIVE', endsAt: { $lte: now } }, { state: { $in: ['CLOSING', 'REFUNDING'] } }] }).sort({ updatedAt: 1 }).limit(50).select('_id').lean().exec();
  for (const campaign of campaigns) await safe('CAMPAIGN', () => settleCampaign(campaign._id));
  const refunds = await FundingRefund.find({ $or: [{ state: { $in: ['PENDING', 'FAILED'] }, $or: [{ retryAt: { $exists: false } }, { retryAt: { $lte: now } }] }, { state: 'PROCESSING', leaseUntil: { $lte: now } }] }).sort({ retryAt: 1, _id: 1 }).limit(100).select('_id').lean().exec();
  for (const refund of refunds) await safe('REFUND', () => processRefund(String(refund._id)));
  for (const campaign of campaigns) await safe('CAMPAIGN', () => settleCampaign(campaign._id));
  await drainPrintOutbox(); return { errors, checkedPayments: payments.length, checkedCampaigns: campaigns.length };
}
export function startPrintWorker() {
  let running = false;
  const tick = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try { const report = await runPrintMaintenance(); if (report.errors?.length) console.error('Print maintenance requires attention:', [...new Set(report.errors)].join(',')); }
    catch { console.error('Print maintenance unavailable.'); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 15000); timer.unref(); return () => clearInterval(timer);
}
