import { jest } from '@jest/globals';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import IyzicoCheckout from '../src/models/iyzicoCheckout.js';
import { PrintTariff, FundingCampaign, FundingPayment, FundingLedger, FundingRefund, PrintPreOrder, PaymentReservation, PrintOutbox } from '../src/models/printFunding.js';
import { initializePrintFunding } from '../src/services/print/common.js';
import { checkout, reconcilePayment, requestRefund, processRefund, simulatePayment, cancelPayment, retryRefund } from '../src/services/print/paymentService.js';
import { printPaymentMode } from '../src/services/print/paymentConfig.js';
import { validCheckoutUrl } from '../src/services/print/iyzicoProvider.js';
import printRoutes from '../src/routes/printRoutes.js';
import { runPrintMaintenance } from '../src/services/print/worker.js';

const require = createRequire(import.meta.url);
const Resource = require('iyzipay/lib/IyzipayResource');
jest.setTimeout(120000);
let user, admin, campaign, remote, created;
const originalEnvironment = { ...process.env };
const signed = (result, fields) => ({ ...result, signature: createHmac('sha256', process.env.IYZICO_SECRET_KEY)
  .update(fields.map(field => ['price', 'paidPrice'].includes(field) ? String(Number(result[field])) : String(result[field] ?? '')).join(':')).digest('hex') });
const input = overrides => ({ campaignId: campaign.id, idempotencyKey: randomUUID(), donationMinor: 10000, ...overrides });
const context = () => ({ user });

beforeAll(async () => { await connect(); await initializePrintFunding(); await Promise.all([User.init(), Book.init()]); });
afterAll(async () => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  await closeDatabase();
});
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', PRINT_SYSTEM_ENABLED: 'true', PRINT_PAYMENTS_MODE: 'IYZICO_SANDBOX',
    IYZICO_API_KEY: 'sandbox-test-api', IYZICO_SECRET_KEY: 'sandbox-test-secret', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com',
    PRINT_ADDRESS_ENCRYPTION_KEY: 'cd'.repeat(32), API_URL: 'http://localhost:5000', CLIENT_URL: 'http://localhost:3000' });
  [user, admin] = await User.create(['reader', 'admin'].map(name => ({ username: name, fullName: `Test ${name}`, email: `${name}@fixture.test`, password: 'test', role: name === 'admin' ? 'ADMIN' : 'USER' })));
  const book = await Book.create({ title: 'Test Kitabı', authorId: admin._id, status: 'COMPLETED' });
  const tariff = await PrintTariff.create({ version: 'iyzico-test', label: 'Test', createdBy: admin._id, pageRates: {}, coverRates: {}, dimensionBps: {}, policy: { donationMinMinor: 5000, donationMaxMinor: 1000000, maxOrderQuantity: 10, reservationMinutes: 15 } });
  campaign = await FundingCampaign.create({ bookId: book._id, authorId: admin._id, applicationId: new mongoose.Types.ObjectId(), versionId: new mongoose.Types.ObjectId(), tariffId: tariff._id,
    title: book.title, targetMinor: 100000, unitPriceMinor: 20000, printRun: 10, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 3600000) });
  remote = new Map(); created = [];
  jest.spyOn(Resource.prototype, 'create').mockImplementation(function (request, callback) {
    if (this._api.create.path.includes('checkoutform/initialize')) {
      created.push(request);
      const token = `token_${request.conversationId}`;
      remote.set(request.conversationId, { token, request, state: 'PENDING', refunds: [] });
      callback(null, signed({ status: 'success', conversationId: request.conversationId, token, paymentPageUrl: `https://sandbox-cpp.iyzipay.com/?token=${token}` }, ['conversationId', 'token']));
    } else if (this._api.create.path === '/payment/refund') {
      const charge = [...remote.values()].find(value => `item_${value.request.conversationId}` === request.paymentTransactionId);
      charge.refunds.push({ refundConversationId: request.conversationId, refundStatus: 1, refundPrice: request.price, refundTxId: 'refund-id' });
      callback(null, signed({ status: 'success', conversationId: request.conversationId, paymentId: `pay_${charge.request.conversationId}`, paymentTransactionId: request.paymentTransactionId, price: request.price, currency: 'TRY' }, ['paymentId', 'price', 'currency', 'conversationId']));
    } else throw new Error('Unexpected provider request');
  });
  jest.spyOn(Resource.prototype, 'retrieve').mockImplementation(function (request, callback) {
    if (this._api.retrieve.path.includes('reporting')) {
      const charge = remote.get(request.paymentConversationId);
      callback(null, { status: 'success', payments: [{ paymentId: `pay_${request.paymentConversationId}`, itemTransactions: [{ refunds: charge.refunds }] }] });
      return;
    }
    const charge = remote.get(request.conversationId);
    if (!charge || charge.state === 'PENDING') return callback(null, { status: 'failure', errorCode: 'PENDING' });
    callback(null, signed({ status: 'success', conversationId: request.conversationId, token: charge.token, basketId: request.conversationId,
      paymentId: `pay_${request.conversationId}`, currency: 'TRY', price: charge.price || charge.request.price, paidPrice: charge.price || charge.request.paidPrice,
      paymentStatus: charge.state === 'CAPTURED' ? 'SUCCESS' : 'FAILURE', fraudStatus: 1,
      itemTransactions: [{ itemId: request.conversationId, paymentTransactionId: `item_${request.conversationId}` }] },
    ['paymentStatus', 'paymentId', 'currency', 'basketId', 'conversationId', 'paidPrice', 'price', 'token']));
  });
});

test('hosted initialization is idempotent and never accepts card fields from the application', async () => {
  const request = input();
  const first = await checkout(context(), request), second = await checkout(context(), request);
  expect(first.id).toBe(second.id); expect(first.provider).toBe('IYZICO_SANDBOX'); expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ conversationId: first.id, basketId: first.id, price: '100.00', paidPrice: '100.00', enabledInstallments: [1] });
  expect(created[0]).not.toHaveProperty('paymentCard');
  expect(created[0].callbackUrl).toBe(`http://localhost:5000/api/print/iyzico/callback/${first.id}`);
  expect((await IyzicoCheckout.findOne()).checkoutUrl).toContain('https://sandbox-cpp.iyzipay.com/');
  await expect(simulatePayment(context(), { paymentId: first.id, outcome: 'CAPTURED' })).rejects.toThrow('iyzico üzerinden');
  expect(await FundingLedger.countDocuments()).toBe(0);
});

test('verified capture allocates once and confirms the encrypted-address preorder', async () => {
  const payment = await checkout(context(), input({ quantity: 1, shippingAddress: { fullName: 'Test Reader', phone: '05555555555', city: 'İstanbul', district: 'Kadıköy', postalCode: '34000', line: 'Test için örnek teslimat adresi', consent: true } }));
  remote.get(payment.id).state = 'CAPTURED';
  await Promise.all([reconcilePayment(payment.id), reconcilePayment(payment.id)]);
  expect((await FundingPayment.findById(payment.id)).state).toBe('CAPTURED');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(30000);
  expect(await FundingLedger.countDocuments({ kind: 'CAPTURE' })).toBe(1);
  expect(await FundingLedger.countDocuments({ kind: 'ALLOCATION' })).toBe(1);
  expect((await PrintPreOrder.findOne()).state).toBe('CONFIRMED');
});

test('a validly signed but wrong amount never increments funding', async () => {
  const payment = await checkout(context(), input());
  Object.assign(remote.get(payment.id), { state: 'CAPTURED', price: '1.00' });
  await expect(reconcilePayment(payment.id)).rejects.toThrow('uyuşmuyor');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(0);
  expect(await FundingLedger.countDocuments()).toBe(0);
});

test('declined cards release the reservation and do not create funding', async () => {
  const payment = await checkout(context(), input()); remote.get(payment.id).state = 'FAILED';
  await reconcilePayment(payment.id, { checkoutCompleted: true });
  expect((await FundingPayment.findById(payment.id)).state).toBe('FAILED');
  expect((await FundingCampaign.findById(campaign.id)).reservedMinor).toBe(0);
  expect(await FundingLedger.countDocuments()).toBe(0);
});

test('an unsuccessful attempt while the hosted form is open keeps its reservation and a subsequent success funds the campaign', async () => {
  const payment = await checkout(context(), input());
  remote.get(payment.id).state = 'FAILED';
  expect((await runPrintMaintenance()).errors).toEqual([]);
  expect((await runPrintMaintenance()).errors).toEqual([]);
  expect((await FundingPayment.findById(payment.id)).state).toBe('PENDING');
  expect((await IyzicoCheckout.findOne({ merchantReference: payment.id })).state).toBe('PENDING');
  expect((await PaymentReservation.findOne({ paymentId: payment._id })).state).toBe('HELD');
  expect((await FundingCampaign.findById(campaign.id)).reservedMinor).toBe(10000);
  expect(await FundingRefund.countDocuments()).toBe(0);
  expect(await PrintOutbox.countDocuments({ key: `payment-failed:${payment.id}` })).toBe(0);
  remote.get(payment.id).state = 'CAPTURED';
  await reconcilePayment(payment.id, { checkoutCompleted: true });
  expect((await FundingPayment.findById(payment.id)).state).toBe('CAPTURED');
  expect((await PaymentReservation.findOne({ paymentId: payment._id })).state).toBe('CONSUMED');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(10000);
  expect(await FundingRefund.countDocuments()).toBe(0);
});

test('a delayed negative response cannot overwrite a concurrent verified capture', async () => {
  const payment = await checkout(context(), input());
  let releaseResponse;
  const requested = new Promise(resolve => { releaseResponse = resolve; });
  Resource.prototype.retrieve.mockImplementationOnce((request, callback) => releaseResponse({ request, callback }));
  const staleReconciliation = reconcilePayment(payment.id, { checkoutCompleted: true });
  const stale = await requested;
  remote.get(payment.id).state = 'CAPTURED';
  await reconcilePayment(payment.id, { checkoutCompleted: true });
  const response = { status: 'success', conversationId: payment.id, token: remote.get(payment.id).token, basketId: payment.id,
    paymentId: `pay_${payment.id}`, currency: 'TRY', price: '100.00', paidPrice: '100.00', paymentStatus: 'FAILURE', fraudStatus: 1 };
  stale.callback(null, signed(response, ['paymentStatus', 'paymentId', 'currency', 'basketId', 'conversationId', 'paidPrice', 'price', 'token']));
  await staleReconciliation;
  expect((await IyzicoCheckout.findOne({ merchantReference: payment.id })).state).toBe('CAPTURED');
  expect((await FundingPayment.findById(payment.id)).state).toBe('CAPTURED');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(10000);
  expect(await FundingLedger.countDocuments({ kind: 'CAPTURE' })).toBe(1);
  expect(await FundingRefund.countDocuments()).toBe(0);
});

test('a late capture after cancellation is fully refunded rather than funded', async () => {
  const payment = await checkout(context(), input());
  await cancelPayment(context(), payment.id);
  expect((await FundingPayment.findById(payment.id)).state).toBe('CANCELLED');
  remote.get(payment.id).state = 'CAPTURED'; await reconcilePayment(payment.id);
  expect((await FundingPayment.findById(payment.id)).state).toBe('REFUND_PENDING');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(0);
  const refund = await FundingRefund.findOne(); await processRefund(refund.id);
  expect((await FundingPayment.findById(payment.id)).state).toBe('REFUNDED');
});

test('invalid provider signatures never create ledger entries', async () => {
  const payment = await checkout(context(), input());
  Resource.prototype.retrieve.mockImplementationOnce((_, callback) => callback(null, { status: 'success', signature: 'ab'.repeat(32) }));
  await expect(reconcilePayment(payment.id)).rejects.toThrow('imzası');
  expect(await FundingLedger.countDocuments()).toBe(0);
  expect((await FundingCampaign.findById(campaign.id)).financeIssue).toBe('PROVIDER_MISMATCH');
});

test.each(['CAPTURED', 'FAILED'])('callback accepts only the stored token and retrieves the signed %s result', async outcome => {
  const payment = await checkout(context(), input()); remote.get(payment.id).state = outcome;
  const app = express(); app.use('/api/print', printRoutes);
  const listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try {
    const url = `http://127.0.0.1:${listener.address().port}/api/print/iyzico/callback/${payment.id}`;
    const post = token => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), redirect: 'manual' });
    expect((await post('wrong-token')).status).toBe(403);
    expect(await FundingLedger.countDocuments()).toBe(0);
    const result = await post(remote.get(payment.id).token);
    expect(result.status).toBe(303); expect(result.headers.get('location')).toBe('http://localhost:3000/funding-history');
    expect((await FundingPayment.findById(payment.id)).state).toBe(outcome);
    expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(outcome === 'CAPTURED' ? 10000 : 0);
    expect((await PaymentReservation.findOne({ paymentId: payment._id })).state).toBe(outcome === 'CAPTURED' ? 'CONSUMED' : 'RELEASED');
    await post(remote.get(payment.id).token);
    expect(await FundingLedger.countDocuments({ kind: 'CAPTURE' })).toBe(outcome === 'CAPTURED' ? 1 : 0);
  } finally { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); }
});

test('full refunds update the ledger and retrying a completed refund does not call iyzico again', async () => {
  const payment = await checkout(context(), input()); remote.get(payment.id).state = 'CAPTURED'; await reconcilePayment(payment.id);
  await requestRefund({ user: admin }, { paymentId: payment.id, reason: 'Test için tam iade' });
  const refund = await FundingRefund.findOne(); await processRefund(refund.id); await processRefund(refund.id);
  expect((await FundingRefund.findById(refund.id)).state).toBe('SUCCEEDED');
  expect((await FundingPayment.findById(payment.id)).state).toBe('REFUNDED');
  expect((await FundingCampaign.findById(campaign.id)).acceptedMinor).toBe(0);
  expect(remote.get(payment.id).refunds).toHaveLength(1);
});

test('reporting recovers a refund after the local save is lost without refunding twice', async () => {
  const payment = await checkout(context(), input()); remote.get(payment.id).state = 'CAPTURED'; await reconcilePayment(payment.id);
  await requestRefund({ user: admin }, { paymentId: payment.id, reason: 'Test için tam iade' });
  const refund = await FundingRefund.findOne();
  jest.spyOn(IyzicoCheckout, 'updateOne').mockRejectedValueOnce(new Error('DATABASE_RESPONSE_LOST'));
  await processRefund(refund.id);
  expect((await FundingRefund.findById(refund.id)).state).toBe('FAILED');
  expect(remote.get(payment.id).refunds).toHaveLength(1);
  await retryRefund({ user: admin }, refund.id);
  expect((await FundingRefund.findById(refund.id)).state).toBe('SUCCEEDED');
  expect(remote.get(payment.id).refunds).toHaveLength(1);
  expect(await FundingLedger.countDocuments({ kind: 'REFUND' })).toBe(1);
});

test('sandbox works in deployment mode but live API URLs and unsafe payment links stay disabled', () => {
  process.env.NODE_ENV = 'production'; expect(printPaymentMode()).toBe('IYZICO_SANDBOX');
  delete process.env.PRINT_PAYMENTS_MODE; delete process.env.PRINT_SYSTEM_ENABLED;
  expect(printPaymentMode()).toBe('IYZICO_SANDBOX');
  process.env.PRINT_SYSTEM_ENABLED = 'false'; expect(printPaymentMode()).toBe('DISABLED');
  delete process.env.PRINT_SYSTEM_ENABLED;
  for (const url of ['https://api.iyzipay.com', 'http://sandbox-api.iyzipay.com', 'https://sandbox-api.iyzipay.com.evil.test']) {
    process.env.IYZICO_BASE_URL = url; expect(printPaymentMode()).toBe('DISABLED');
  }
  expect(validCheckoutUrl('javascript:alert(1)')).toBe(false);
  expect(validCheckoutUrl('https://sandbox-cpp.iyzipay.com.evil.test')).toBe(false);
});
