import Book from '../../models/book.js';
import User from '../../models/user.js';
import { FundingCampaign, PrintApplication, PrintTariff, BookPrintVersion, FundingPayment, PaymentReservation, FundingRefund, FundingLedger, PrintPreOrder, CampaignUpdate, PrintInterest } from '../../models/printFunding.js';
import { actor, owner, fail, id, int, text, transact, audit, notice, page, initializePrintCampaignManagement } from './common.js';
import { sandboxEnabled } from './paymentProvider.js';
import { digitalState, writingState } from './applicationService.js';
import { releaseReservation, queueRefund } from './paymentService.js';

export async function openCampaign(context, { applicationId, revision, days }) {
  await actor(context, null, true);
  await initializePrintCampaignManagement();
  try { return await transact(async session => {
    const user = await actor(context, session, true), application = await PrintApplication.findById(id(applicationId)).session(session);
    if (!application || application.state !== 'APPROVED' || application.revision !== revision || !application.verifiedQuote) throw fail('Yalnızca güncel, onaylı başvurudan kampanya açılabilir.');
    const book = await Book.findOne({ _id: application.bookId, isDeleted: false }).session(session);
    if (!book || digitalState(book) !== 'PUBLISHED' || writingState(book) !== 'COMPLETED') throw fail('Kitap yayımlanmış ve tamamlanmış olmalı.');
    if (!await User.exists({ _id: application.authorId, isDeleted: false, isActive: { $ne: false } }).session(session)) throw fail('Kampanya için aktif yazar hesabı gerekli.');
    if (await FundingCampaign.exists({ bookId: book._id, $or: [{ activeLock: true }, { state: 'REFUNDING' }, { state: 'SUCCEEDED', productionState: { $nin: ['COMPLETED', 'CANCELLED'] } }] }).session(session)) throw fail('Kitabın mevcut kampanya, üretim veya iade süreci önce tamamlanmalı.', 'CONFLICT');
    const version = await BookPrintVersion.findById(application.versionId).session(session), tariff = await PrintTariff.findById(application.tariffId).session(session);
    const duration = int(days ?? tariff.policy.campaignDays, 'Kampanya gün sayısı', 1, 90), now = new Date();
    const [campaign] = await FundingCampaign.create([{ bookId: book._id, authorId: application.authorId, applicationId: application._id, versionId: version._id, tariffId: tariff._id, title: version.title, targetMinor: int(application.approvedTargetMinor, 'Onaylı hedef', 1), unitPriceMinor: int(application.approvedUnitPriceMinor, 'Onaylı satış fiyatı', 1), printRun: version.specification.printRun, startsAt: now, endsAt: new Date(now.getTime() + duration * 86400000) }], { session });
    // Serialize campaign opening with author cancellation and publication changes.
    application.revision += 1; await application.save({ session });
    await Book.updateOne({ _id: book._id }, { $inc: { printRevision: 1 } }, { session });
    await audit(session, user._id, campaign._id, 'CAMPAIGN_OPENED', '', 'ACTIVE', 'Onaylı hedef ve fiyat sabitlendi.', { applicationId: application.id, targetMinor: campaign.targetMinor, unitPriceMinor: campaign.unitPriceMinor });
    await notice(session, `campaign-open:${campaign.id}`, campaign.authorId, 'Destek kampanyası oluşturuldu', sandboxEnabled() ? 'Sandbox kampanyanız test desteği kabul ediyor.' : 'Kampanyanız oluşturuldu. Ödemeler ve ön sipariş işlemleri kapalıdır.', campaign._id);
    await CampaignUpdate.create([{ campaignId: campaign._id, state: 'ACTIVE', message: 'Test kampanyası başladı. Gerçek para tahsilatı yapılmaz.', createdBy: user._id }], { session }); return campaign;
  }); } catch (error) { if (error.code === 11000) throw fail('Yazarın/kitabın aktif kampanyası veya bu başvuru/sürümün kampanyası zaten var.', 'CONFLICT'); throw error; }
}
export async function closeCampaign(context, { campaignId, reason }) {
  await actor(context, null, true);
  await initializePrintCampaignManagement();
  return transact(async session => {
    const user = await actor(context, session, true), campaign = await FundingCampaign.findById(id(campaignId)).session(session);
    if (!campaign || !['ACTIVE', 'CLOSING'].includes(campaign.state)) throw fail('Kampanya bu aşamada kapatılamaz.');
    campaign.state = 'CLOSING'; campaign.outcome = 'CANCELLED'; await campaign.save({ session });
    await audit(session, user._id, campaign._id, 'CAMPAIGN_CANCELLED', 'ACTIVE', 'CLOSING', text(reason, 'İptal gerekçesi', 5)); return campaign;
  });
}
export async function expireReservation(reservationId, now = new Date()) {
  return transact(async session => {
    const reservation = await PaymentReservation.findById(reservationId).session(session);
    if (!reservation || reservation.state !== 'HELD' || reservation.expiresAt > now) return null;
    const payment = await FundingPayment.findById(reservation.paymentId).session(session), campaign = await FundingCampaign.findById(reservation.campaignId).session(session);
    await releaseReservation(session, payment, campaign, 'EXPIRED');
    if (!payment.captured) { payment.state = 'CANCELLED'; await payment.save({ session }); await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'CANCELLED' } }, { session }); }
    await campaign.save({ session });
    await audit(session, null, payment._id, 'RESERVATION_EXPIRED', 'HELD', 'EXPIRED'); return payment.id;
  });
}
export async function settleCampaign(campaignId, now = new Date(), { unfundedOnly = false } = {}) {
  return transact(async session => {
    const campaign = await FundingCampaign.findById(campaignId).session(session);
    if (!campaign) return;
    if (unfundedOnly) {
      // This check shares the campaign transaction with checkout's conditional
      // write. Any financial history requires normal sandbox reconciliation.
      if (campaign.acceptedMinor || campaign.reservedMinor || campaign.soldQuantity || campaign.reservedQuantity || campaign.financeIssue) return;
      for (const model of [FundingPayment, PaymentReservation, FundingLedger, FundingRefund, PrintPreOrder]) {
        if (await model.exists({ campaignId: campaign._id }).session(session)) return;
      }
    }
    if (campaign.state === 'ACTIVE' && campaign.endsAt <= now) { campaign.state = 'CLOSING'; campaign.outcome = 'DEADLINE'; }
    if (campaign.state === 'CLOSING') {
      // Bounded drain: new checkout is already blocked on the same campaign document.
      const held = await PaymentReservation.find({ campaignId, state: 'HELD' }).limit(50).session(session);
      for (const reservation of held) {
        const payment = await FundingPayment.findById(reservation.paymentId).session(session);
        await releaseReservation(session, payment, campaign);
        if (!payment.captured) { payment.state = 'CANCELLED'; await payment.save({ session }); await PrintPreOrder.updateOne({ paymentId: payment._id }, { $set: { state: 'CANCELLED' } }, { session }); }
      }
      if (campaign.reservedMinor) { await campaign.save({ session }); return campaign; }
      const totals = await FundingLedger.aggregate([{ $match: { campaignId: campaign._id, kind: { $in: ['ALLOCATION', 'DEALLOCATION'] } } }, { $group: { _id: '$kind', total: { $sum: '$amountMinor' } } }]).session(session);
      const net = (totals.find(row => row._id === 'ALLOCATION')?.total || 0) - (totals.find(row => row._id === 'DEALLOCATION')?.total || 0);
      if (net !== campaign.acceptedMinor || net > campaign.targetMinor) {
        campaign.financeIssue = 'LEDGER_MISMATCH'; await campaign.save({ session }); return campaign;
      }
      const pendingRefund = await FundingRefund.exists({ campaignId, state: { $ne: 'SUCCEEDED' } }).session(session);
      if (campaign.outcome === 'TARGET' && net === campaign.targetMinor && !pendingRefund && !campaign.financeIssue) {
        campaign.state = 'SUCCEEDED'; campaign.activeLock = false; campaign.productionState = 'PREPARATION'; campaign.reconciledAt = now;
        await CampaignUpdate.create([{ campaignId, state: 'PREPARATION', message: 'Kampanya uzlaştırıldı; basım hazırlığı başladı.' }], { session });
        await notice(session, `success:${campaign.id}`, campaign.authorId, 'Kampanya başarıyla tamamlandı', 'Basım hazırlık süreci başladı.', campaign._id, true);
        await audit(session, null, campaign._id, 'CAMPAIGN_SETTLED', 'CLOSING', 'SUCCEEDED');
      } else if (campaign.outcome !== 'TARGET' || net !== campaign.targetMinor) {
        campaign.state = 'REFUNDING';
        await notice(session, `campaign-failed:${campaign.id}`, campaign.authorId, 'Kampanya kapandı', 'Hedef karşılanmadı veya kampanya iptal edildi. Tahsilatlar tam iade sürecine alınıyor.', campaign._id, true);
        await audit(session, null, campaign._id, 'CAMPAIGN_REFUNDING', 'CLOSING', 'REFUNDING', campaign.outcome);
      }
    }
    if (campaign.state === 'REFUNDING') {
      const payments = await FundingPayment.find({ campaignId, captured: true, state: { $nin: ['REFUND_PENDING', 'REFUNDED'] } }).limit(50).session(session);
      for (const payment of payments) { await queueRefund(session, payment, 'CAMPAIGN_UNSUCCESSFUL'); await payment.save({ session }); }
      const remaining = await FundingPayment.exists({ campaignId, captured: true, state: { $ne: 'REFUNDED' } }).session(session);
      const moreHeld = await PaymentReservation.exists({ campaignId, state: 'HELD' }).session(session);
      if (!remaining && !moreHeld) {
        const hadRefund = await FundingRefund.exists({ campaignId }).session(session);
        campaign.state = hadRefund ? 'REFUNDED' : campaign.outcome === 'CANCELLED' ? 'CANCELLED' : 'FAILED'; campaign.activeLock = false; campaign.reconciledAt = now;
        await audit(session, null, campaign._id, 'CAMPAIGN_CLOSED', 'REFUNDING', campaign.state);
      }
    }
    if (!campaign.activeLock) await PrintApplication.updateOne({ _id: campaign.applicationId }, { $set: { open: false } }, { session });
    await campaign.save({ session }); return campaign;
  });
}
const productionTransitions = { PREPARATION: ['PRINTER_APPROVED'], PRINTER_APPROVED: ['STARTED'], STARTED: ['PRINTING'], PRINTING: ['PRINTED'], PRINTED: ['PACKAGING'], PACKAGING: ['SHIPPING'], SHIPPING: ['DELIVERED'], DELIVERED: ['COMPLETED'] };
export async function updateProduction(context, { campaignId, revision, state, message }) {
  return transact(async session => {
    const user = await actor(context, session, true), campaign = await FundingCampaign.findById(id(campaignId)).session(session);
    if (!campaign || campaign.state !== 'SUCCEEDED' || campaign.productionRevision !== revision || ['COMPLETED', 'CANCELLED'].includes(campaign.productionState)) throw fail('Üretim bu aşamada güncellenemez veya kayıt değişmiş.', 'CONFLICT');
    const from = campaign.productionState, note = text(message, 'Üretim açıklaması', 5);
    if (state === 'ISSUE' && from !== 'ISSUE') campaign.previousProductionState = from;
    else if (from === 'ISSUE' && state === campaign.previousProductionState) campaign.previousProductionState = undefined;
    else if (state !== 'CANCELLED' && !(productionTransitions[from] || []).includes(state)) throw fail('Geçersiz üretim durum geçişi.');
    if (['DELIVERED', 'COMPLETED'].includes(state) && await PrintPreOrder.exists({ campaignId, state: { $nin: ['DELIVERED', 'REFUNDED', 'CANCELLED'] } }).session(session)) throw fail('Ön siparişlerin teslimatları tamamlanmalı.');
    campaign.productionState = state; campaign.productionRevision += 1;
    if (state === 'CANCELLED') {
      campaign.state = 'REFUNDING'; campaign.outcome = 'CANCELLED';
      await Book.updateOne({ _id: campaign.bookId }, { $inc: { printRevision: 1 } }, { session });
    }
    await campaign.save({ session });
    await CampaignUpdate.create([{ campaignId, state, message: note, createdBy: user._id }], { session });
    await audit(session, user._id, campaign._id, 'PRODUCTION_UPDATED', from, state, note);
    await notice(session, `production:${campaign.id}:${campaign.productionRevision}`, campaign.authorId, 'Basım süreci güncellendi', note, campaign._id, true); return campaign;
  });
}
export async function updateOrder(context, { orderId, revision, state, carrier, trackingNumber, reason }) {
  return transact(async session => {
    const user = await actor(context, session, true), order = await PrintPreOrder.findById(id(orderId)).session(session);
    if (!order || order.revision !== revision) throw fail('Sipariş bulunamadı veya değişmiş.', 'CONFLICT');
    const campaign = await FundingCampaign.findById(order.campaignId).session(session), payment = await FundingPayment.findById(order.paymentId).session(session);
    if (campaign.state !== 'SUCCEEDED' || !payment.allocated || payment.state !== 'CAPTURED') throw fail('Teslimat için kesinleşmiş ödeme ve başarılı kampanya gerekli.');
    const allowed = { CONFIRMED: ['PACKAGING', 'ISSUE'], PACKAGING: ['SHIPPED', 'ISSUE'], SHIPPED: ['DELIVERED', 'ISSUE'], ISSUE: [order.previousState] };
    if (!(allowed[order.state] || []).includes(state)) throw fail('Geçersiz sipariş geçişi.');
    if (state === 'PACKAGING' && !['PRINTED', 'PACKAGING', 'SHIPPING', 'DELIVERED'].includes(campaign.productionState)) throw fail('Kitabın baskısı tamamlanmalı.');
    if (state === 'SHIPPED') { order.carrier = text(carrier, 'Kargo firması', 2, 100); order.trackingNumber = text(trackingNumber, 'Takip numarası', 3, 100); }
    const from = order.state;
    if (state === 'ISSUE') order.previousState = from;
    order.state = state; order.revision += 1; await order.save({ session });
    await audit(session, user._id, order._id, 'ORDER_UPDATED', from, state, text(reason, 'Sipariş açıklaması', 5));
    await notice(session, `order:${order.id}:${order.revision}`, order.userId, 'Ön sipariş durumu güncellendi', `${state}: ${reason}`, campaign._id); return order;
  });
}
export async function campaigns(context, { admin = false, mine = false, page: p = 1 } = {}) {
  const user = admin || mine ? await actor(context, null, admin) : null;
  return FundingCampaign.find(mine ? { authorId: user._id } : {}).sort({ createdAt: -1, _id: -1 }).skip((page(p) - 1) * 20).limit(20).exec();
}
export async function campaignForBook(bookId) { return FundingCampaign.findOne({ bookId: id(bookId) }).sort({ createdAt: -1, _id: -1 }).exec(); }
export async function printOverview(context, bookId) {
  const book = await Book.findOne({ _id: id(bookId), isDeleted: false }).exec();
  if (!book || book.kind === 'PRINTED') throw fail('Dijital kitap bulunamadı.');
  if (!await User.exists({ _id: book.authorId, isDeleted: false, isActive: { $ne: false } })) throw fail('Kitap erişilebilir değil.');
  const isOwner = context.user && String(context.user._id || context.user.id) === String(book.authorId);
  if (digitalState(book) === 'DRAFT' && !isOwner) throw fail('Kitap erişilebilir değil.', 'FORBIDDEN');
  const campaign = await campaignForBook(bookId);
  return { bookId: book.id, digitalStatus: digitalState(book), writingStatus: writingState(book), interestCount: await PrintInterest.countDocuments({ bookId }), interested: Boolean(context.user && await PrintInterest.exists({ bookId, userId: context.user._id || context.user.id })), campaign };
}
