import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { SandboxCharge } from '../../models/printFunding.js';
import { fail, int } from './common.js';
import { printPaymentMode } from './paymentConfig.js';
import { iyzicoProvider } from './iyzicoProvider.js';

export function sandboxEnabled() { return printPaymentMode() !== 'DISABLED'; }
export function assertSandbox() { if (!sandboxEnabled()) throw fail('Ödemeler kapalı. iyzico test sağlayıcısını veya geliştirme simülasyonunu etkinleştirin.', 'PAYMENTS_DISABLED'); }
const signature = (timestamp, raw) => createHmac('sha256', process.env.PRINT_SANDBOX_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex');
function assertMock() { if (printPaymentMode() !== 'SANDBOX') throw fail('Simülasyon yalnızca yerel test sağlayıcısında kullanılabilir.', 'PAYMENTS_DISABLED'); }

/** Provider contract: initialize({reference,amountMinor,currency}), retrieve(reference),
 * cancel(reference), refund({reference,refundReference,amountMinor}), verifyWebhook(raw,headers).
 * All commands MUST be idempotent by reference; retrieve is authoritative. No live adapter exists.
 */
export const sandboxProvider = {
  async initialize({ reference, amountMinor, currency }) {
    assertSandbox(); int(amountMinor, 'Ödeme tutarı', 1);
    let charge;
    try { charge = await SandboxCharge.findOneAndUpdate({ merchantReference: reference }, { $setOnInsert: { merchantReference: reference, amountMinor, currency } }, { upsert: true, new: true }).exec(); }
    catch (error) { if (error.code !== 11000) throw error; charge = await SandboxCharge.findOne({ merchantReference: reference }).exec(); }
    if (charge.amountMinor !== amountMinor || charge.currency !== currency) throw fail('Sağlayıcı idempotency uyuşmazlığı.', 'CONFLICT');
    return charge;
  },
  async retrieve(reference) { assertSandbox(); return SandboxCharge.findOne({ merchantReference: reference }).exec(); },
  async cancel(reference) { assertSandbox(); return SandboxCharge.findOneAndUpdate({ merchantReference: reference, state: { $in: ['PENDING', 'FAILED'] } }, { $set: { state: 'CANCELLED' }, $inc: { revision: 1 } }, { new: true }).exec(); },
  async refund({ reference, refundReference, amountMinor }) {
    assertSandbox();
    const charge = await this.retrieve(reference);
    if (!charge || charge.amountMinor !== amountMinor) throw fail('İade tutarı veya sağlayıcı işlemi uyuşmuyor.');
    if (charge.refundFailure) throw new Error('SANDBOX_REFUND_UNAVAILABLE');
    if (charge.state === 'REFUNDED' && charge.refundReference === refundReference) return { id: charge.refundId, amountMinor, state: 'SUCCEEDED' };
    if (charge.state !== 'CAPTURED') throw new Error('SANDBOX_PAYMENT_NOT_CAPTURED');
    await SandboxCharge.updateOne({ _id: charge._id, state: 'CAPTURED' }, { $set: { state: 'REFUNDED', refundReference, refundId: `sandbox_refund_${randomUUID()}` }, $inc: { revision: 1 } });
    const result = await this.retrieve(reference);
    if (result.refundReference !== refundReference) throw new Error('SANDBOX_REFUND_REFERENCE_MISMATCH');
    return { id: result.refundId, amountMinor, state: 'SUCCEEDED' };
  },
  verifyWebhook(raw, headers) {
    assertSandbox();
    const timestamp = headers['x-betik-timestamp'], supplied = headers['x-betik-signature'];
    if (!Buffer.isBuffer(raw) || !/^\d{10,13}$/.test(String(timestamp)) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(String(supplied))) throw fail('Webhook imzası veya zamanı geçersiz.', 'FORBIDDEN');
    if (!timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(signature(timestamp, raw), 'hex'))) throw fail('Webhook imzası geçersiz.', 'FORBIDDEN');
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { throw fail('Webhook verisi geçersiz.'); }
    if (typeof event.reference !== 'string' || !/^[a-f0-9]{24}$/.test(event.reference)) throw fail('Webhook işlem kimliği geçersiz.');
    return event;
  },
  envelope(charge) {
    assertSandbox();
    const raw = Buffer.from(JSON.stringify({ reference: charge.merchantReference, eventId: `sandbox:${charge.id}:${charge.revision}` }));
    const timestamp = String(Date.now()); return { raw, headers: { 'x-betik-timestamp': timestamp, 'x-betik-signature': signature(timestamp, raw) } };
  },
  async simulate(reference, outcome) {
    assertSandbox(); if (!['CAPTURED', 'FAILED', 'CANCELLED'].includes(outcome)) throw fail('Geçerli sandbox sonucu seçin.');
    const charge = await this.retrieve(reference);
    if (!charge) throw fail('Sandbox işlemi bulunamadı.');
    // Capture is monotonic. FAILED/CANCELLED may later settle, to exercise late-success recovery.
    await SandboxCharge.updateOne({ _id: charge._id, state: { $nin: ['CAPTURED', 'REFUNDED'] } }, { $set: { state: outcome, ...(outcome === 'CAPTURED' ? { capturedAt: new Date() } : {}) }, $inc: { revision: 1 } });
    return this.retrieve(reference);
  },
};
export function getPaymentProvider(provider = printPaymentMode()) {
  assertSandbox();
  if (provider === 'IYZICO_SANDBOX') return iyzicoProvider;
  if (provider === 'SANDBOX') { assertMock(); return sandboxProvider; }
  throw fail('Ödeme sağlayıcısı desteklenmiyor.', 'PAYMENTS_DISABLED');
}
