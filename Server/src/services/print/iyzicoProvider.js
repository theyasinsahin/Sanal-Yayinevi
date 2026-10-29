import Iyzipay from 'iyzipay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import IyzicoCheckout from '../../models/iyzicoCheckout.js';
import { FundingPayment, PrintPreOrder } from '../../models/printFunding.js';
import User from '../../models/user.js';
import { decryptAddress } from './addressCrypto.js';
import { fail, int } from './common.js';
import { iyzicoSandboxConfigured, printPaymentMode } from './paymentConfig.js';

export function assertIyzicoSandbox() {
  if (printPaymentMode() !== 'IYZICO_SANDBOX' || !iyzicoSandboxConfigured()) throw fail('iyzico test ödemeleri yapılandırılmamış.', 'PAYMENTS_DISABLED');
}

// A fresh SDK instance per request avoids its mutable request-body configuration
// crossing concurrent payments. Only the sandbox API origin is accepted.
export function iyzicoRequest(resource, method, input) {
  assertIyzicoSandbox();
  const client = new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: 'https://sandbox-api.iyzipay.com' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(fail('iyzico yanıtı alınamadı. Aynı işlemi yeniden sorgulayın.', 'PROVIDER_UNAVAILABLE')), 20000);
    client[resource][method](input, (error, result) => {
      clearTimeout(timer);
      if (error || !result) reject(fail('iyzico bağlantısı kurulamadı.', 'PROVIDER_UNAVAILABLE'));
      else resolve(result);
    });
  });
}

export function verifyIyzicoSignature(result, fields) {
  const values = fields.map(field => ['price', 'paidPrice'].includes(field) && result[field] != null ? String(Number(result[field])) : String(result[field] ?? ''));
  const expected = createHmac('sha256', process.env.IYZICO_SECRET_KEY).update(values.join(':')).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(result.signature || '') || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(result.signature, 'hex'))) {
    throw fail('iyzico yanıt imzası doğrulanamadı.', 'PAYMENT_MISMATCH');
  }
}

export function validCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && ['sandbox-cpp.iyzipay.com', 'sandbox-api.iyzipay.com'].includes(url.hostname); } catch { return false; }
}

function snapshot(record) {
  return { id: record.token, merchantReference: record.merchantReference, provider: 'IYZICO_SANDBOX', amountMinor: record.amountMinor,
    currency: record.currency, state: record.state, revision: ['PENDING', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED'].indexOf(record.state), capturedAt: record.capturedAt };
}
const decimal = minor => (int(minor, 'Tutar', 1) / 100).toFixed(2);
const minor = value => {
  if (!/^\d+(?:\.\d{1,8})?$/.test(String(value))) throw fail('iyzico tutarı geçersiz.', 'PAYMENT_MISMATCH');
  const amount = Number(value) * 100;
  if (!Number.isSafeInteger(Math.round(amount)) || Math.abs(amount - Math.round(amount)) > 0.00001) throw fail('iyzico tutarı geçersiz.', 'PAYMENT_MISMATCH');
  return Math.round(amount);
};
export const iyzicoProvider = {
  async initialize({ reference, amountMinor, currency }) {
    assertIyzicoSandbox();
    let record;
    try { record = await IyzicoCheckout.findOneAndUpdate({ merchantReference: reference }, { $setOnInsert: { merchantReference: reference, amountMinor, currency } }, { upsert: true, new: true }); }
    catch (error) { if (error.code !== 11000) throw error; record = await IyzicoCheckout.findOne({ merchantReference: reference }); }
    if (record.amountMinor !== amountMinor || record.currency !== currency) throw fail('Ödeme tutarı uyuşmuyor.', 'PAYMENT_MISMATCH');
    if (record.token) return snapshot(record);
    const claimed = await IyzicoCheckout.findOneAndUpdate({ _id: record._id, token: { $exists: false }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now() + 45000) } });
    if (!claimed) throw fail('Ödeme sayfası hazırlanıyor. Aynı işlemi yeniden sorgulayın.', 'PROVIDER_BUSY');
    try {
      const payment = await FundingPayment.findById(reference), user = payment && await User.findById(payment.userId);
      if (!user) throw fail('Ödeme kullanıcısı bulunamadı.');
      const order = await PrintPreOrder.findOne({ paymentId: reference }).select('+shippingAddress');
      const shipping = order ? decryptAddress(order.shippingAddress, reference) : null;
      const fullName = shipping?.fullName || user.fullName || user.username;
      const parts = fullName.trim().split(/\s+/), name = parts.shift(), surname = parts.join(' ') || name;
      const address = { contactName: fullName, city: shipping?.city || 'İstanbul', country: 'Turkey', address: shipping?.line || 'iyzico sandbox test adresi', zipCode: shipping?.postalCode || '34000' };
      const callbackBase = process.env.SERVER_URL || process.env.BACKEND_URL || process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
      const callbackUrl = new URL(`/api/print/iyzico/callback/${reference}`, callbackBase).href;
      const result = await iyzicoRequest('checkoutFormInitialize', 'create', {
        locale: 'tr', conversationId: reference, basketId: reference, price: decimal(amountMinor), paidPrice: decimal(amountMinor), currency, paymentGroup: 'PRODUCT',
        callbackUrl, enabledInstallments: [1],
        buyer: { id: user.id, name, surname, email: user.email, identityNumber: '11111111111', gsmNumber: shipping?.phone || '+905350000000',
          registrationAddress: address.address, city: address.city, country: address.country, zipCode: address.zipCode, ip: '127.0.0.1' },
        shippingAddress: address, billingAddress: address,
        basketItems: [{ id: reference, name: payment.quantity ? 'Kitap ön siparişi ve destek' : 'Kitap basım desteği', category1: 'Kitap', itemType: payment.quantity ? 'PHYSICAL' : 'VIRTUAL', price: decimal(amountMinor) }],
      });
      if (result.status !== 'success') throw fail('iyzico ödeme sayfası hazırlanamadı. Yapılandırmayı kontrol edip aynı işlemi yeniden deneyin.', 'PROVIDER_UNAVAILABLE');
      verifyIyzicoSignature(result, ['conversationId', 'token']);
      if (result.conversationId !== reference || !result.token || !validCheckoutUrl(result.paymentPageUrl)) throw fail('iyzico ödeme sayfası doğrulanamadı.', 'PAYMENT_MISMATCH');
      record = await IyzicoCheckout.findByIdAndUpdate(record._id, { $set: { token: result.token, checkoutUrl: result.paymentPageUrl }, $unset: { leaseUntil: 1 } }, { new: true });
      return snapshot(record);
    } catch (error) { await IyzicoCheckout.updateOne({ _id: record._id, token: { $exists: false } }, { $unset: { leaseUntil: 1 } }); throw error; }
  },
  async retrieve(reference, { checkoutCompleted = false } = {}) {
    assertIyzicoSandbox();
    let record = await IyzicoCheckout.findOne({ merchantReference: reference });
    if (!record?.token) return null;
    if (record.state === 'REFUNDED') return snapshot(record);
    const result = await iyzicoRequest('checkoutForm', 'retrieve', { locale: 'tr', conversationId: reference, token: record.token });
    if (result.status !== 'success') {
      // An unfinished checkout is not a declined charge. Only a verified terminal
      // response may release the reservation; late captures remain reconcilable.
      if (record.cancelled) await IyzicoCheckout.updateOne({ _id: record._id, state: { $nin: ['CAPTURED', 'REFUNDED'] } }, { $set: { state: 'CANCELLED' } });
      return snapshot(await IyzicoCheckout.findById(record._id));
    }
    verifyIyzicoSignature(result, ['paymentStatus', 'paymentId', 'currency', 'basketId', 'conversationId', 'paidPrice', 'price', 'token']);
    if (result.token !== record.token || result.conversationId !== reference || result.basketId !== reference || result.currency !== record.currency
      || minor(result.price) !== record.amountMinor || minor(result.paidPrice) !== record.amountMinor) throw fail('iyzico işlem tutarı veya kimliği uyuşmuyor.', 'PAYMENT_MISMATCH');
    if (result.paymentStatus === 'SUCCESS' && Number(result.fraudStatus) === 1) {
      const item = result.itemTransactions?.[0];
      if (!result.paymentId || result.itemTransactions?.length !== 1 || item.itemId !== reference || !item.paymentTransactionId) throw fail('iyzico ödeme kalemi uyuşmuyor.', 'PAYMENT_MISMATCH');
      if (record.paymentId && record.paymentId !== String(result.paymentId)) throw fail('iyzico ödeme kimliği değişti.', 'PAYMENT_MISMATCH');
      await IyzicoCheckout.updateOne({ _id: record._id, state: { $ne: 'REFUNDED' } }, { $set: {
        paymentId: String(result.paymentId), paymentTransactionId: String(item.paymentTransactionId), state: 'CAPTURED', capturedAt: record.capturedAt || new Date(),
      } });
    } else if (record.cancelled || (checkoutCompleted && (result.paymentStatus === 'FAILURE' || Number(result.fraudStatus) === -1))) {
      // A card/3DS attempt may fail while the hosted checkout remains open for
      // another attempt. Polling must keep its reservation until the verified
      // browser callback, explicit cancellation, or reservation expiry.
      // A slower negative response must never overwrite a concurrent capture.
      await IyzicoCheckout.updateOne({ _id: record._id, state: { $nin: ['CAPTURED', 'REFUNDED'] } }, {
        $set: { state: record.cancelled ? 'CANCELLED' : 'FAILED' },
      });
    }
    return snapshot(await IyzicoCheckout.findById(record._id));
  },
  async cancel(reference) {
    assertIyzicoSandbox();
    await IyzicoCheckout.updateOne({ merchantReference: reference }, { $set: { cancelled: true } });
    // Closing our reservation never claims that the hosted checkout was revoked.
    // Any subsequent successful card payment is retrieved and fully refunded.
    return this.retrieve(reference);
  },
  async refund({ reference, refundReference, amountMinor }) {
    assertIyzicoSandbox();
    let record = await IyzicoCheckout.findOne({ merchantReference: reference });
    if (!record || record.amountMinor !== amountMinor || !record.paymentTransactionId) throw fail('İade işlemi uyuşmuyor.', 'PAYMENT_MISMATCH');
    if (record.refundId && record.refundReference === refundReference) return { id: record.refundId, state: 'SUCCEEDED', amountMinor };
    // Reporting recovers a successful refund whose API response/database write
    // was lost, before another refund request can be sent.
    const report = await iyzicoRequest('reportingTransactionDetails', 'retrieve', { locale: 'tr', conversationId: refundReference, paymentConversationId: reference });
    if (report.status !== 'success') throw fail('İade durumu iyzico üzerinden doğrulanamadı.', 'PROVIDER_UNAVAILABLE');
    const matches = report.payments?.filter(payment => String(payment.paymentId) === record.paymentId) || [];
    const recovered = matches.flatMap(payment => payment.itemTransactions || []).flatMap(item => item.refunds || [])
      .find(refund => refund.refundConversationId === refundReference && Number(refund.refundStatus) === 1 && minor(refund.refundPrice) === amountMinor);
    let result;
    if (recovered) result = { id: String(recovered.refundTxId) };
    else {
      const response = await iyzicoRequest('refund', 'create', { locale: 'tr', conversationId: refundReference, paymentTransactionId: record.paymentTransactionId, price: decimal(amountMinor), currency: record.currency, ip: '127.0.0.1' });
      if (response.status !== 'success') throw fail('iyzico iadesi tamamlanamadı.', 'PROVIDER_UNAVAILABLE');
      verifyIyzicoSignature(response, ['paymentId', 'price', 'currency', 'conversationId']);
      if (String(response.paymentId) !== record.paymentId || response.conversationId !== refundReference || minor(response.price) !== amountMinor || response.currency !== record.currency) throw fail('iyzico iade yanıtı uyuşmuyor.', 'PAYMENT_MISMATCH');
      result = { id: String(response.paymentTransactionId || response.paymentId) };
    }
    await IyzicoCheckout.updateOne({ _id: record._id }, { $set: { state: 'REFUNDED', refundReference, refundId: result.id } });
    return { ...result, amountMinor, state: 'SUCCEEDED' };
  },
};
