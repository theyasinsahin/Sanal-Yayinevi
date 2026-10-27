import mongoose from 'mongoose';
import Book from '../../models/book.js';
import User from '../../models/user.js';
import { FundingCampaign, PrintTariff, FundingPayment, PaymentReservation, PrintPreOrder, FundingLedger, FundingPaymentEvent, FundingRefund, CampaignSupporter } from '../../models/printFunding.js';
import { actor, fail, id, int, text, hash, transact, audit, notice } from './common.js';
import { digitalState } from './applicationService.js';
import { getPaymentProvider, assertSandbox } from './paymentProvider.js';
import { encryptAddress } from './addressCrypto.js';

function addressOf(input) {
  if (!input || input.consent !== true) throw fail('Teslimat için veri işleme onayı gerekli.');
  return { fullName: text(input.fullName, 'Alıcı', 3, 120), phone: text(input.phone, 'Telefon', 10, 20), city: text(input.city, 'İl', 2, 60), district: text(input.district, 'İlçe', 2, 60), postalCode: text(input.postalCode, 'Posta kodu', 5, 10), line: text(input.line, 'Adres', 10, 500), country: 'TR' };
}
async function attachProvider(payment) {
  const provider = getPaymentProvider();
  const charge = await provider.initialize({ reference: payment.id, amountMinor: payment.amountMinor, currency: payment.currency });
  await FundingPayment.updateOne({ _id: payment._id, state: 'CREATED' }, { $set: { providerId: charge.id, state: 'PENDING' } });
  return FundingPayment.findById(payment._id).exec();
}
export async function checkout(context, input) {
  assertSandbox();
  const user = await actor(context), campaignId = id(input.campaignId);
  const key = text(input.idempotencyKey, 'İşlem anahtarı', 16, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw fail('İşlem anahtarı geçersiz.');
  const quantity = int(input.quantity ?? 0, 'Adet', 0, 100), donationMinor = int(input.donationMinor ?? 0, 'Karşılıksız destek', 0, 100000000);
  const address = quantity ? addressOf(input.shippingAddress) : null;
  const requestHash = hash({ campaignId: String(campaignId), quantity, donationMinor, address });
  const existing = await FundingPayment.findOne({ userId: user._id, idempotencyKey: key }).exec();
  if (existing) {
    if (existing.requestHash !== requestHash) throw fail('Aynı işlem anahtarı farklı içerikle kullanılamaz.', 'CONFLICT');
    return existing.state === 'CREATED' ? attachProvider(existing) : existing;
  }
  let payment;
  try { payment = await transact(async session => {
    await actor(context, session);
    const duplicate = await FundingPayment.findOne({ userId: user._id, idempotencyKey: key }).session(session);
    if (duplicate) { if (duplicate.requestHash !== requestHash) throw fail('İşlem anahtarı uyuşmuyor.', 'CONFLICT'); return duplicate; }
    const campaign = await FundingCampaign.findById(campaignId).session(session);
    if (!campaign || campaign.environment !== 'SANDBOX') throw fail('Kampanya bulunamadı.');
    const book = await Book.findOne({ _id: campaign.bookId, isDeleted: false }).session(session);
    if (!book || digitalState(book) !== 'PUBLISHED') throw fail('Kitap şu anda destek kabul etmiyor.');
    if (!await User.exists({ _id: campaign.authorId, isDeleted: false, isActive: { $ne: false } }).session(session)) throw fail('Yazar hesabı destek kabul etmiyor.');
    const tariff = await PrintTariff.findById(campaign.tariffId).session(session), policy = tariff.policy;
    if (quantity > policy.maxOrderQuantity || (donationMinor && (donationMinor < policy.donationMinMinor || donationMinor > policy.donationMaxMinor))) throw fail('Destek veya sipariş tutarı yapılandırılmış sınırları aşıyor.');
    const orderMinor = int(quantity * campaign.unitPriceMinor, 'Ön sipariş toplamı');
    const amountMinor = int(orderMinor + donationMinor, 'Toplam tutar', 1, 100000000);
    const now = new Date(), expiresAt = new Date(Math.min(now.getTime() + policy.reservationMinutes * 60000, campaign.endsAt.getTime()));
    const reserved = await FundingCampaign.findOneAndUpdate({ _id: campaign._id, state: 'ACTIVE', financeIssue: '', startsAt: { $lte: now }, endsAt: { $gt: now }, $expr: { $and: [ { $lte: [{ $add: ['$acceptedMinor', '$reservedMinor', amountMinor] }, '$targetMinor'] }, { $lte: [{ $add: ['$soldQuantity', '$reservedQuantity', quantity] }, '$printRun'] } ] } }, { $inc: { reservedMinor: amountMinor, reservedQuantity: quantity } }, { session, new: true });
    if (!reserved) throw fail('Kampanya kapalı veya kalan hedef/stok bu işlemin tam bedeli için yeterli değil. Tutarınız değiştirilmedi.', 'CAPACITY_EXCEEDED');
    const [created] = await FundingPayment.create([{ userId: user._id, campaignId: campaign._id, bookId: campaign.bookId, idempotencyKey: key, requestHash, amountMinor, donationMinor, orderMinor, quantity }], { session });
    await PaymentReservation.create([{ paymentId: created._id, campaignId: campaign._id, amountMinor, quantity, expiresAt }], { session });
    if (quantity) await PrintPreOrder.create([{ paymentId: created._id, campaignId: campaign._id, userId: user._id, quantity, unitPriceMinor: campaign.unitPriceMinor, totalMinor: orderMinor, shippingAddress: encryptAddress(address, created.id), consent: { version: 'shipping-sandbox-v1', acceptedAt: now.toISOString(), purpose: 'Sipariş teslimatı; yalnızca yetkili operasyon erişimi' } }], { session });
    await audit(session, user._id, created._id, 'CHECKOUT_RESERVED', '', 'CREATED', '', { amountMinor, campaignId: campaign.id }); return created;
  }); } catch (error) {
    if (error.code !== 11000) throw error;
    payment = await FundingPayment.findOne({ userId: user._id, idempotencyKey: key }).exec();
    if (!payment || payment.requestHash !== requestHash) throw fail('İşlem anahtarı çakıştı.', 'CONFLICT');
  }
  // Provider communication is intentionally outside the database transaction.
  // A lost response leaves CREATED recoverable by initialize(reference) in the worker.
  return payment.state === 'CREATED' ? attachProvider(payment) : payment;
}
export async function releaseReservation(session, payment, campaign, state = 'RELEASED') {
  const reservation = await PaymentReservation.findOneAndUpdate({ paymentId: payment._id, state: 'HELD' }, { $set: { state } }, { new: true, session });
  if (reservation) { campaign.reservedMinor -= reservation.amountMinor; campaign.reservedQuantity -= reservation.quantity; }
  return reservation;
}
export async function queueRefund(session, payment, reason) {
  if (!payment.captured || payment.state === 'REFUNDED') return;
  payment.state = 'REFUND_PENDING';
  await FundingRefund.updateOne({ paymentId: payment._id }, { $setOnInsert: { paymentId: payment._id, campaignId: payment.campaignId, userId: payment.userId, amountMinor: payment.amountMinor, reason, state: 'PENDING' } }, { session, upsert: true });
  await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'REFUND_PENDING' } }, { session });
  await notice(session, `refund-pending:${payment.id}`, payment.userId, 'İade başlatıldı', 'Sandbox ödemeniz tam iade için işleme alındı.', payment.campaignId);
}
const ledger = (session, payment, kind) => FundingLedger.create([{ key: `${kind}:${payment.id}`, campaignId: payment.campaignId, paymentId: payment._id, userId: payment.userId, kind, amountMinor: payment.amountMinor }], { session });

async function applyProviderState(reference, charge) {
  const eventId = `sandbox:${charge.id}:${charge.revision}`;
  const payloadHash = hash({ reference, amountMinor: charge.amountMinor, currency: charge.currency, state: charge.state, revision: charge.revision });
  try { return await transact(async session => {
    const payment = await FundingPayment.findById(id(reference)).session(session);
    if (!payment || payment.provider !== 'SANDBOX') throw fail('Ödeme kaydı bulunamadı.');
    if (charge.merchantReference !== payment.id || charge.amountMinor !== payment.amountMinor || charge.currency !== payment.currency || (payment.providerId && payment.providerId !== charge.id)) throw fail('Sağlayıcı işlem/tutar/para birimi uyuşmazlığı.', 'PAYMENT_MISMATCH');
    const oldEvent = await FundingPaymentEvent.findOne({ eventId }).session(session);
    if (oldEvent) { if (oldEvent.payloadHash !== payloadHash) throw fail('Olay içeriği uyuşmuyor.', 'PAYMENT_MISMATCH'); return payment; }
    await FundingPaymentEvent.create([{ eventId, paymentId: payment._id, payloadHash, providerState: charge.state }], { session });
    const campaign = await FundingCampaign.findById(payment.campaignId).session(session);
    const reservation = await PaymentReservation.findOne({ paymentId: payment._id }).session(session);
    if (!campaign || !reservation) throw fail('Finansal ilişkiler eksik.', 'FINANCE_INTEGRITY');
    payment.providerId = charge.id; payment.reconciledAt = new Date();
    if (charge.state === 'CAPTURED' && !payment.captured) {
      const now = new Date();
      payment.captured = true; payment.capturedAt = charge.capturedAt; await ledger(session, payment, 'CAPTURE');
      const acceptable = reservation.state === 'HELD' && reservation.expiresAt > now && campaign.endsAt > now && campaign.state === 'ACTIVE' && !campaign.financeIssue && campaign.acceptedMinor + payment.amountMinor <= campaign.targetMinor;
      await releaseReservation(session, payment, campaign, acceptable ? 'CONSUMED' : 'EXPIRED');
      if (acceptable) {
        payment.state = 'CAPTURED'; payment.allocated = true; campaign.acceptedMinor += payment.amountMinor; campaign.soldQuantity += payment.quantity;
        await ledger(session, payment, 'ALLOCATION');
        let supporter = await CampaignSupporter.findOne({ campaignId: campaign._id, userId: payment.userId }).session(session);
        if (!supporter) supporter = new CampaignSupporter({ campaignId: campaign._id, userId: payment.userId });
        if (!supporter.activePayments) campaign.supporterCount += 1;
        supporter.activePayments += 1; await supporter.save({ session });
        await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'CONFIRMED' } }, { session });
        await notice(session, `capture:${payment.id}`, payment.userId, 'Test desteği kaydedildi', 'Sandbox desteğiniz kaydedildi. Gerçek para tahsil edilmedi.', campaign._id);
        if (campaign.acceptedMinor === campaign.targetMinor) {
          campaign.state = 'CLOSING'; campaign.outcome = 'TARGET';
          await notice(session, `target:${campaign.id}`, campaign.authorId, 'Kampanya hedefine ulaştı', 'Ödemeler uzlaştırılıyor.', campaign._id, true);
        }
      } else await queueRefund(session, payment, 'LATE_OR_CLOSED_CAPTURE');
    } else if (['FAILED', 'CANCELLED'].includes(charge.state) && !payment.captured) {
      const released = await releaseReservation(session, payment, campaign);
      payment.state = charge.state;
      await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'CANCELLED' } }, { session });
      if (released) await notice(session, `payment-failed:${payment.id}`, payment.userId, 'Test ödemesi tamamlanamadı', 'Rezervasyon serbest bırakıldı. Yeni işlem başlatabilirsiniz.', campaign._id);
    } else if (charge.state === 'PENDING' && payment.state === 'CREATED') payment.state = 'PENDING';
    // A provider REFUNDED result is finalized by the refund saga, never by a client result.
    await payment.save({ session }); await campaign.save({ session });
    await audit(session, null, payment._id, 'PROVIDER_RECONCILED', '', charge.state, '', { eventId }); return payment;
  }); } catch (error) {
    if (error.code !== 11000) throw error;
    const event = await FundingPaymentEvent.findOne({ eventId }).exec();
    if (!event || event.payloadHash !== payloadHash) throw error;
    return FundingPayment.findById(reference).exec();
  }
}
export async function reconcilePayment(reference) {
  const provider = getPaymentProvider();
  let payment = await FundingPayment.findById(id(reference)).exec();
  if (!payment) throw fail('Ödeme bulunamadı.');
  if (payment.state === 'CREATED') payment = await attachProvider(payment);
  const charge = await provider.retrieve(payment.id);
  if (!charge && payment.state === 'CANCELLED' && !payment.providerId) {
    // Expired before provider initialization: there is no external charge to reconcile.
    await FundingPayment.updateOne({ _id: payment._id }, { $set: { reconciledAt: new Date() } }); return payment;
  }
  if (!charge) throw fail('Sağlayıcıda ödeme bulunamadı.', 'PROVIDER_UNAVAILABLE');
  let result;
  try { result = await applyProviderState(payment.id, charge); }
  catch (error) {
    if (error.extensions?.code === 'PAYMENT_MISMATCH') {
      await FundingPayment.updateOne({ _id: payment._id }, { $set: { issue: 'PROVIDER_MISMATCH' } });
      await FundingCampaign.updateOne({ _id: payment.campaignId }, { $set: { financeIssue: 'PROVIDER_MISMATCH' } });
    }
    throw error;
  }
  await FundingPayment.updateOne({ _id: payment._id }, { $set: { reconciledAt: new Date() } });
  return result;
}
export async function receiveWebhook(raw, headers) {
  const envelope = getPaymentProvider().verifyWebhook(raw, headers);
  return reconcilePayment(envelope.reference);
}
export async function simulatePayment(context, { paymentId, outcome }) {
  const user = await actor(context), payment = await FundingPayment.findOne({ _id: id(paymentId), userId: user._id }).exec();
  if (!payment) throw fail('Ödeme bulunamadı.', 'FORBIDDEN');
  if (payment.state === 'CREATED') await attachProvider(payment);
  const provider = getPaymentProvider(), charge = await provider.simulate(payment.id, outcome);
  const envelope = provider.envelope(charge); return receiveWebhook(envelope.raw, envelope.headers);
}
export async function cancelPayment(context, paymentId) {
  const user = await actor(context), payment = await FundingPayment.findOne({ _id: id(paymentId), userId: user._id }).exec();
  if (!payment) throw fail('Ödeme bulunamadı.', 'FORBIDDEN');
  if (payment.state === 'CREATED') await attachProvider(payment);
  await getPaymentProvider().cancel(payment.id); return reconcilePayment(payment.id);
}
export async function requestRefund(context, { paymentId, reason }) {
  return transact(async session => {
    const user = await actor(context, session, true), payment = await FundingPayment.findById(id(paymentId)).session(session);
    if (!payment || !payment.captured) throw fail('Tahsil edilmiş ödeme gerekli.');
    const campaign = await FundingCampaign.findById(payment.campaignId).session(session);
    if (!['ACTIVE', 'CLOSING', 'REFUNDING', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(campaign.state) && campaign.productionState !== 'CANCELLED') throw fail('Başarılı kampanyada iade için önce üretim iptal süreci gerekli.');
    await queueRefund(session, payment, text(reason, 'İade gerekçesi', 5)); await payment.save({ session });
    await audit(session, user._id, payment._id, 'REFUND_REQUESTED', '', 'REFUND_PENDING', reason); return payment;
  });
}
export async function processRefund(refundId) {
  const now = new Date();
  const refund = await FundingRefund.findOneAndUpdate({ _id: id(refundId), $or: [ { state: { $in: ['PENDING', 'FAILED'] }, $or: [{ retryAt: { $exists: false } }, { retryAt: { $lte: now } }] }, { state: 'PROCESSING', leaseUntil: { $lte: now } } ] }, { $set: { state: 'PROCESSING', leaseUntil: new Date(now.getTime() + 60000) }, $inc: { attempts: 1 } }, { new: true }).exec();
  if (!refund) return;
  try {
    const result = await getPaymentProvider().refund({ reference: String(refund.paymentId), refundReference: refund.id, amountMinor: refund.amountMinor });
    if (result.state !== 'SUCCEEDED' || result.amountMinor !== refund.amountMinor) throw new Error('PROVIDER_REFUND_MISMATCH');
    await transact(async session => {
      const current = await FundingRefund.findById(refund._id).session(session);
      if (current.state === 'SUCCEEDED') return;
      const payment = await FundingPayment.findById(current.paymentId).session(session), campaign = await FundingCampaign.findById(current.campaignId).session(session);
      if (!payment.captured || payment.amountMinor !== current.amountMinor) throw fail('İade muhasebesi uyuşmuyor.', 'FINANCE_INTEGRITY');
      await ledger(session, payment, 'REFUND');
      if (payment.allocated) {
        await ledger(session, payment, 'DEALLOCATION'); campaign.acceptedMinor -= payment.amountMinor; campaign.soldQuantity -= payment.quantity; payment.allocated = false;
        const supporter = await CampaignSupporter.findOne({ campaignId: campaign._id, userId: payment.userId }).session(session);
        supporter.activePayments -= 1; if (!supporter.activePayments) campaign.supporterCount -= 1; await supporter.save({ session });
        if (campaign.state === 'CLOSING' && campaign.outcome === 'TARGET') {
          if (campaign.endsAt > new Date()) { campaign.state = 'ACTIVE'; campaign.outcome = undefined; }
          else campaign.outcome = 'DEADLINE';
        }
      }
      current.state = 'SUCCEEDED'; current.providerRefundId = result.id; current.lastError = ''; payment.state = 'REFUNDED';
      await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'REFUNDED' } }, { session });
      await payment.save({ session }); await campaign.save({ session }); await current.save({ session });
      await notice(session, `refund-done:${payment.id}`, payment.userId, 'Test iadesi tamamlandı', 'Sandbox ödemenizin tamamı iade edildi.', campaign._id);
      await audit(session, null, payment._id, 'REFUND_SUCCEEDED', 'REFUND_PENDING', 'REFUNDED');
    });
  } catch (error) {
    await FundingRefund.updateOne({ _id: refund._id, state: { $ne: 'SUCCEEDED' } }, { $set: { state: 'FAILED', lastError: error.extensions?.code || 'PROVIDER_OR_DATABASE_ERROR', retryAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(refund.attempts, 7))) } });
    // Error details deliberately exclude provider payloads, addresses and secrets.
  }
}
export async function retryRefund(context, refundId) {
  const user = await actor(context, null, true);
  await FundingRefund.updateOne({ _id: id(refundId), state: 'FAILED' }, { $set: { state: 'PENDING', retryAt: new Date() } });
  await audit(null, user._id, new mongoose.Types.ObjectId(refundId), 'REFUND_RETRY', 'FAILED', 'PENDING');
  await processRefund(refundId); return FundingRefund.findById(refundId).exec();
}
