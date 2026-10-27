import { jest } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse, validate } from 'graphql';
import express from 'express';
import jwt from 'jsonwebtoken';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase, getTestDatabaseUri } from './db.js';
import mongoose from 'mongoose';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Notification from '../src/models/notification.js';
import Transaction from '../src/models/transaction.js';
import PointEvent from '../src/models/pointEvent.js';
import UserScore from '../src/models/userScore.js';
import * as models from '../src/models/printFunding.js';
import * as applications from '../src/services/print/applicationService.js';
import * as campaigns from '../src/services/print/campaignService.js';
import * as payments from '../src/services/print/paymentService.js';
import { initializePrintFunding } from '../src/services/print/common.js';
import { uploadAsset, downloadAsset } from '../src/services/print/assetService.js';
import { getPaymentProvider } from '../src/services/print/paymentProvider.js';
import { runPrintMaintenance, drainPrintOutbox } from '../src/services/print/worker.js';
import printResolvers from '../src/graphql/resolvers/printFunding.js';
import bookResolvers from '../src/graphql/resolvers/book.js';
import printRoutes from '../src/routes/printRoutes.js';
import legacyPaymentRoutes from '../src/routes/paymentRoutes.js';
import { softDeleteBook } from '../src/services/bookService.js';
import { migratePrintFields } from '../src/services/print/migration.js';
import { decryptAddress } from '../src/services/print/addressCrypto.js';

jest.setTimeout(180000);
let user, reader, other, admin, book, tariff, cover, api;
const context = actor => ({ user: actor });
const pdf = title => Buffer.from(`%PDF-1.4\n${title}\n%%EOF`);
const policy = { donationMinMinor: 5000, donationMaxMinor: 10000000, quickAmountsMinor: [5000, 10000, 25000, 50000], campaignDays: 30, reservationMinutes: 15, maxOrderQuantity: 10 };
const tariffInput = { version: 'example-v1', label: 'ÖRNEK SANDBOX — gerçek matbaa fiyatı değildir', pageRates: { enzo: 10, ivory: 15, coated: 20 }, coverRates: { paperback: 1000, hardcover: 2000 }, dimensionBps: { '13.5x21': 10000, '16x24': 12000 }, colorBps: 20000, setupMinor: 10000, packagingPerUnitMinor: 1000, shippingPerUnitMinor: 1000, serviceMinor: 10000, taxBps: 2000, feeBps: 500, policy };
const address = { fullName: 'Test Alıcı', phone: '05555555555', city: 'İstanbul', district: 'Kadıköy', postalCode: '34700', line: 'Tamamen örnek test teslimat adresi', consent: true };
const applicationInput = () => ({ bookId: book.id, tariffId: tariff.id, specification: { dimension: '13.5x21', paperType: 'enzo', coverType: 'paperback', color: 'BW', printRun: 10, coverAssetId: cover.id, coverDpi: 300, bleedMm: 3, notes: '-' }, declarations: { copyright: true, permissions: true, terms: true } });
const quote = () => ({ source: 'SANDBOX ÖRNEK TEKLİF 1', layoutAssetId: cover.id, quoteAssetId: cover.id, confirmedPages: 120, preflightConfirmed: true, components: { printingMinor: 50000, shippingMinor: 10000, packagingMinor: 10000, taxMinor: 10000, providerFeeMinor: 10000, serviceMinor: 10000, otherMinor: 0 }, sale: { unitProductionMinor: 5000, unitShippingMinor: 1000, unitPackagingMinor: 1000, unitTaxMinor: 1000, unitFeeMinor: 1000, unitServiceMinor: 1000, unitMarginMinor: 10000 } });
async function submitted() { const app = await applications.saveApplication(context(user), applicationInput()); return applications.submitApplication(context(user), { applicationId: app.id, revision: app.revision }); }
async function approved() { const app = await submitted(); return applications.reviewApplication(context(admin), { applicationId: app.id, revision: app.revision, decision: 'APPROVED', reason: 'Örnek belgeler sandbox için incelendi.', quote: quote() }); }
async function campaign() { const app = await approved(); return campaigns.openCampaign(context(admin), { applicationId: app.id, revision: app.revision }); }
const checkout = (campaign, overrides = {}, actor = reader) => payments.checkout(context(actor), { campaignId: campaign.id, idempotencyKey: randomUUID(), donationMinor: 10000, ...overrides });
const capture = payment => payments.simulatePayment(context({ _id: payment.userId }), { paymentId: payment.id, outcome: 'CAPTURED' });
async function run(query, variables, actor = reader) { return (await api.executeOperation({ query, variables }, { contextValue: { user: actor, Book, User, Chapter } })).body.singleResult; }
beforeAll(async () => {
  process.env.PRINT_SYSTEM_ENABLED = 'true'; process.env.PRINT_PAYMENTS_MODE = 'SANDBOX'; process.env.PRINT_SANDBOX_WEBHOOK_SECRET = 'test-only-secret-at-least-thirty-two-bytes';
  process.env.PRINT_ADDRESS_ENCRYPTION_KEY = 'ab'.repeat(32);
  await connect(); await initializePrintFunding(); await Promise.all([User.init(), Book.init(), Chapter.init(), Notification.init(), Transaction.init()]);
  api = new ApolloServer({ schema }); await api.start();
});
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [user, reader, other, admin] = await User.create(['author', 'reader', 'other', 'admin'].map(username => ({ username, fullName: username, email: `${username}@example.test`, password: 'hash', role: username === 'admin' ? 'ADMIN' : 'USER' })));
  book = await Book.create({ title: 'Basım Romanı', authorId: user._id, status: 'COMPLETED' });
  await Chapter.create({ bookId: book._id, authorId: user._id, title: 'Bölüm', content: '<p>Bu metin sabit sürüm olarak basılacak.</p>' });
  tariff = await applications.createTariff(context(admin), tariffInput); cover = await uploadAsset(context(user), pdf('kapak'), 'kapak.pdf');
});

test('digital publication and completion remain separate and never create a campaign', async () => {
  await Book.updateOne({ _id: book._id }, { status: 'DRAFT' });
  await bookResolvers.Mutation.updateBookStatus(null, { bookId: book.id, status: 'WRITING' }, context(user));
  let published = await Book.findById(book.id); expect(published.digitalStatus).toBe('PUBLISHED'); expect(published.writingStatus).toBe('WRITING');
  await expect(applications.saveApplication(context(user), applicationInput())).rejects.toThrow('tamamlanmış');
  published = await applications.updateDigitalStatus(context(user), { bookId: book.id, status: 'COMPLETED' });
  expect(published.writingStatus).toBe('COMPLETED'); expect(await models.FundingCampaign.countDocuments()).toBe(0);
  await expect(bookResolvers.Mutation.updateBookStatus(null, { bookId: book.id, status: 'FUNDING', fundingTarget: 1 }, context(user))).rejects.toThrow('onaylı');
});
test('only the author can apply; approval needs a current admin and complete declarations/files', async () => {
  await expect(applications.saveApplication(context(other), applicationInput())).rejects.toThrow('yazar');
  await expect(applications.saveApplication(context(user), { ...applicationInput(), declarations: { copyright: true } })).rejects.toThrow('koşulları');
  const app = await submitted();
  await expect(campaigns.openCampaign(context(admin), { applicationId: app.id, revision: app.revision })).rejects.toThrow('onaylı');
  await expect(applications.reviewApplication(context(reader), { applicationId: app.id, revision: app.revision })).rejects.toThrow('yönetici');
  await User.updateOne({ _id: admin._id }, { role: 'USER' });
  await expect(applications.reviewApplication(context(admin), { applicationId: app.id, revision: app.revision })).rejects.toThrow('yönetici');
});
test('revision keeps immutable versions and rejection cannot collect funds', async () => {
  let app = await submitted(); const old = await models.BookPrintVersion.findById(app.versionId);
  app = await applications.reviewApplication(context(admin), { applicationId: app.id, revision: app.revision, decision: 'REVISION_REQUESTED', reason: 'Kapak mizanpajı düzeltilmeli.' });
  await Chapter.updateOne({ bookId: book._id }, { content: 'Sonradan değişen dijital içerik.' });
  app = await applications.saveApplication(context(user), { ...applicationInput(), revision: app.revision });
  expect(String(app.versionId)).not.toBe(old.id); expect((await models.BookPrintVersion.findById(old.id)).contentHash).toBe(old.contentHash);
  expect((await models.BookPrintVersion.findById(old.id)).chapters[0].content).toContain('sabit sürüm');
  await expect(models.BookPrintVersion.updateOne({ _id: old._id }, { title: 'Değiştir' })).rejects.toThrow('Değişmez');
  app = await applications.submitApplication(context(user), { applicationId: app.id, revision: app.revision });
  app = await applications.reviewApplication(context(admin), { applicationId: app.id, revision: app.revision, decision: 'REJECTED', reason: 'Teknik dosya uygun değil.' });
  await expect(campaigns.openCampaign(context(admin), { applicationId: app.id, revision: app.revision })).rejects.toThrow('onaylı');
});
test('concurrent approval has one decision; campaign unique locks prevent duplicate version/book/author campaigns', async () => {
  let app = await submitted();
  const results = await Promise.allSettled(['APPROVED', 'REJECTED'].map(decision => applications.reviewApplication(context(admin), { applicationId: app.id, revision: app.revision, decision, reason: 'Yönetici incelemesi tamamlandı.', quote: quote() })));
  expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
  app = await models.PrintApplication.findById(app._id);
  if (app.state !== 'APPROVED') { await models.PrintApplication.updateOne({ _id: app._id }, { state: 'APPROVED', verifiedQuote: quote(), approvedTargetMinor: 100000, approvedUnitPriceMinor: 20000 }); app = await models.PrintApplication.findById(app._id); }
  const opens = await Promise.allSettled(Array.from({ length: 8 }, () => campaigns.openCampaign(context(admin), { applicationId: app.id, revision: app.revision })));
  expect(opens.filter(row => row.status === 'fulfilled')).toHaveLength(1);
  const first = await models.FundingCampaign.findOne();
  await expect(models.FundingCampaign.create({ ...first.toObject(), _id: undefined, applicationId: new (await import('mongoose')).default.Types.ObjectId(), versionId: new (await import('mongoose')).default.Types.ObjectId() })).rejects.toMatchObject({ code: 11000 });
  book = await Book.create({ title: 'Aynı yazarın ikinci kitabı', authorId: user._id, status: 'COMPLETED' });
  await Chapter.create({ bookId: book._id, authorId: user._id, title: 'İkinci kitap', content: 'İkinci kitap tamamlanmış metni.' });
  const second = await approved();
  await expect(campaigns.openCampaign(context(admin), { applicationId: second.id, revision: second.revision })).rejects.toThrow('Yazarın/kitabın aktif kampanyası');
});
test('mixed preorder and donation are calculated on the server once; addresses are private', async () => {
  const c = await campaign(), payment = await checkout(c, { quantity: 2, donationMinor: 5000, shippingAddress: address, amountMinor: 1 });
  expect(payment.amountMinor).toBe(45000); expect(payment.orderMinor).toBe(40000);
  await capture(payment);
  const saved = await models.FundingCampaign.findById(c.id); expect(saved.acceptedMinor).toBe(45000); expect(saved.soldQuantity).toBe(2);
  const order = await models.PrintPreOrder.findOne({ paymentId: payment._id }); expect(order.state).toBe('CONFIRMED'); expect(order.shippingAddress).toBeUndefined();
  await expect(printResolvers.PrintPreOrder.shippingAddress(order, {}, context(user))).rejects.toThrow('erişiminiz');
  expect((await printResolvers.PrintPreOrder.shippingAddress(order, {}, context(reader))).line).toBe(address.line);
  expect(await printResolvers.Query.myPrintOrders(null, {}, context(other))).toEqual([]);
  expect((await printResolvers.Query.myPrintOrders(null, {}, context(reader)))).toHaveLength(1);
  expect(await Transaction.countDocuments()).toBe(0);
});
test('120 truly parallel reservations and parallel captures cannot exceed exact target', async () => {
  const c = await campaign();
  const readers = await User.create(Array.from({ length: 120 }, (_, index) => ({ username: `parallel_${index}`, fullName: `Test reader ${index}`, email: `parallel_${index}@example.test`, password: 'test-hash' })));
  const attempts = await Promise.allSettled(readers.map(actor => checkout(c, { donationMinor: 5000 }, actor)));
  const accepted = attempts.filter(row => row.status === 'fulfilled').map(row => row.value);
  expect(accepted).toHaveLength(20);
  let saved = await models.FundingCampaign.findById(c.id); expect(saved.reservedMinor).toBe(100000); expect(saved.acceptedMinor).toBe(0);
  await Promise.all(accepted.map(capture));
  saved = await models.FundingCampaign.findById(c.id); expect(saved.acceptedMinor).toBe(100000); expect(saved.reservedMinor).toBe(0); expect(saved.supporterCount).toBe(20); expect(saved.state).toBe('CLOSING');
  await campaigns.settleCampaign(c.id); saved = await models.FundingCampaign.findById(c.id); expect(saved.state).toBe('SUCCEEDED'); expect(saved.productionState).toBe('PREPARATION');
  expect(await models.FundingLedger.countDocuments({ kind: 'ALLOCATION' })).toBe(20);
});
test('simultaneous duplicate checkout, repeated webhook and lost initialization response do not duplicate', async () => {
  const c = await campaign(), idempotencyKey = randomUUID();
  const results = await Promise.all(Array.from({ length: 15 }, () => checkout(c, { idempotencyKey })));
  expect(new Set(results.map(item => item.id)).size).toBe(1); expect(await models.SandboxCharge.countDocuments()).toBe(1);
  await expect(checkout(c, { idempotencyKey, donationMinor: 5000 })).rejects.toThrow('farklı');
  const payment = results[0], provider = getPaymentProvider(), charge = await provider.simulate(payment.id, 'CAPTURED'), envelope = provider.envelope(charge);
  await Promise.all(Array.from({ length: 15 }, () => payments.receiveWebhook(envelope.raw, envelope.headers)));
  expect(await models.FundingLedger.countDocuments({ kind: 'CAPTURE' })).toBe(1); expect(await models.FundingLedger.countDocuments({ kind: 'ALLOCATION' })).toBe(1);
  expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(10000);
  await drainPrintOutbox(); await drainPrintOutbox(); expect(await Notification.countDocuments({ dedupKey: `print:capture:${payment.id}:${reader.id}` })).toBe(1);
});
test('invalid signatures, payload manipulation, fractional money and disabled/live mode are rejected', async () => {
  const c = await campaign(), payment = await checkout(c), provider = getPaymentProvider();
  const charge = await provider.simulate(payment.id, 'CAPTURED'), envelope = provider.envelope(charge);
  await expect(payments.receiveWebhook(envelope.raw, { ...envelope.headers, 'x-betik-signature': '0'.repeat(64) })).rejects.toThrow('imzası');
  await expect(payments.receiveWebhook(envelope.raw, { ...envelope.headers, 'x-betik-timestamp': '1000000000000' })).rejects.toThrow('zamanı');
  await models.SandboxCharge.updateOne({ _id: charge._id }, { amountMinor: 1 });
  await expect(payments.receiveWebhook(envelope.raw, envelope.headers)).rejects.toThrow('uyuşmazlığı');
  expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(0);
  await expect(checkout(c)).rejects.toThrow('kapalı');
  await expect(checkout(c, { donationMinor: 1.5 })).rejects.toThrow('tam sayı');
  process.env.NODE_ENV = 'production';
  try { await expect(checkout(c)).rejects.toThrow('kapalı'); } finally { process.env.NODE_ENV = 'test'; }
});
test('failed/cancelled payments release capacity; later success is refunded and gives no order rights', async () => {
  const c = await campaign(), payment = await checkout(c, { quantity: 1, donationMinor: 0, shippingAddress: address });
  await payments.simulatePayment(context(reader), { paymentId: payment.id, outcome: 'FAILED' });
  expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(0); expect((await models.FundingCampaign.findById(c.id)).reservedMinor).toBe(0);
  expect((await models.PrintPreOrder.findOne()).state).toBe('CANCELLED');
  await capture(payment); expect((await models.FundingPayment.findById(payment.id)).state).toBe('REFUND_PENDING');
  await runPrintMaintenance(); expect((await models.FundingPayment.findById(payment.id)).state).toBe('REFUNDED');
  expect((await models.PrintPreOrder.findOne()).state).toBe('REFUNDED'); expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(0);
});
test('expiration releases reservation and a delayed capture is refunded, even when another user fills target', async () => {
  const c = await campaign(), late = await checkout(c);
  await models.PaymentReservation.updateOne({ paymentId: late._id }, { expiresAt: new Date(Date.now() - 1000) });
  await campaigns.expireReservation((await models.PaymentReservation.findOne({ paymentId: late._id })).id);
  const full = await checkout(c, { donationMinor: 100000 }); await capture(full);
  await capture(late); await runPrintMaintenance();
  const saved = await models.FundingCampaign.findById(c.id); expect(saved.acceptedMinor).toBe(100000); expect(saved.state).toBe('SUCCEEDED');
  expect((await models.FundingPayment.findById(late.id)).state).toBe('REFUNDED');
});
test('deadline/capture race follows strict receipt deadline and unsuccessful campaigns fully refund', async () => {
  const c = await campaign(), accepted = await checkout(c), pending = await checkout(c); await capture(accepted);
  await models.FundingCampaign.updateOne({ _id: c._id }, { endsAt: new Date(Date.now() - 1) });
  await Promise.all([campaigns.settleCampaign(c.id), capture(pending)]);
  await runPrintMaintenance(); await runPrintMaintenance();
  const saved = await models.FundingCampaign.findById(c.id); expect(saved.state).toBe('REFUNDED'); expect(saved.acceptedMinor).toBe(0); expect(saved.reservedMinor).toBe(0);
  expect(await models.FundingPayment.countDocuments({ state: 'REFUNDED' })).toBe(2);
});
test('provider response loss is recovered and failed refunds are visible, retryable and idempotent', async () => {
  const c = await campaign(), provider = getPaymentProvider(), original = provider.initialize.bind(provider);
  jest.spyOn(provider, 'initialize').mockImplementationOnce(async input => { await original(input); throw new Error('RESPONSE_LOST'); });
  await expect(checkout(c)).rejects.toThrow('RESPONSE_LOST');
  let payment = await models.FundingPayment.findOne(); expect(payment.state).toBe('CREATED');
  await runPrintMaintenance(); payment = await models.FundingPayment.findById(payment.id); expect(payment.state).toBe('PENDING'); expect(await models.SandboxCharge.countDocuments()).toBe(1);
  await capture(payment); await models.SandboxCharge.updateOne({ merchantReference: payment.id }, { refundFailure: true });
  await campaigns.closeCampaign(context(admin), { campaignId: c.id, reason: 'Örnek iptal ve iade testi.' }); await runPrintMaintenance();
  const refund = await models.FundingRefund.findOne(); expect(refund.state).toBe('FAILED'); expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(10000);
  await models.SandboxCharge.updateOne({ merchantReference: payment.id }, { refundFailure: false });
  await payments.retryRefund(context(admin), refund.id); await payments.processRefund(refund.id); await runPrintMaintenance();
  expect((await models.FundingRefund.findById(refund.id)).state).toBe('SUCCEEDED'); expect(await models.FundingLedger.countDocuments({ kind: 'REFUND' })).toBe(1);
  expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(0);
});
test('preorder indivisibility, stock, donation bounds and missing addresses are enforced', async () => {
  const c = await campaign(); await checkout(c, { donationMinor: 90000 });
  await expect(checkout(c, { quantity: 1, donationMinor: 0, shippingAddress: address })).rejects.toThrow('tam bedeli');
  await expect(checkout(c, { quantity: 1, donationMinor: 0 })).rejects.toThrow('onayı');
  await expect(checkout(c, { donationMinor: 4999 })).rejects.toThrow('sınırları');
  await expect(checkout(c, { quantity: 11, shippingAddress: address })).rejects.toThrow('sınırları');
});
test('production and delivery need settled funding, preserve separate states and protect tracking updates', async () => {
  let c = await campaign(); const payment = await checkout(c, { quantity: 1, donationMinor: 80000, shippingAddress: address });
  await capture(payment); c = await campaigns.settleCampaign(c.id);
  const order = await models.PrintPreOrder.findOne();
  await expect(campaigns.updateProduction(context(reader), { campaignId: c.id, revision: 0, state: 'PRINTED', message: 'Atlama denemesi.' })).rejects.toThrow('yönetici');
  await expect(campaigns.updateProduction(context(admin), { campaignId: c.id, revision: 0, state: 'PRINTED', message: 'Atlama denemesi.' })).rejects.toThrow('Geçersiz');
  for (const state of ['PRINTER_APPROVED', 'STARTED', 'PRINTING', 'PRINTED', 'PACKAGING', 'SHIPPING']) c = await campaigns.updateProduction(context(admin), { campaignId: c.id, revision: c.productionRevision, state, message: `Test üretim adımı ${state}` });
  let current = order;
  for (const state of ['PACKAGING', 'SHIPPED', 'DELIVERED']) current = await campaigns.updateOrder(context(admin), { orderId: current.id, revision: current.revision, state, carrier: 'Test Kargo', trackingNumber: 'TEST-12345', reason: `Test teslimat adımı ${state}` });
  expect(current.trackingNumber).toBe('TEST-12345');
  c = await campaigns.updateProduction(context(admin), { campaignId: c.id, revision: c.productionRevision, state: 'DELIVERED', message: 'Siparişler teslim edildi.' });
  c = await campaigns.updateProduction(context(admin), { campaignId: c.id, revision: c.productionRevision, state: 'COMPLETED', message: 'Basım süreci tamamlandı.' }); expect(c.productionState).toBe('COMPLETED');
});
test('free print interest is unique under parallel requests, separate from likes, and removable', async () => {
  await Promise.all(Array.from({ length: 20 }, () => applications.setInterest(context(reader), { bookId: book.id, interested: true })));
  expect(await models.PrintInterest.countDocuments()).toBe(1); expect((await Book.findById(book.id)).stats.likes).toBe(0);
  await applications.setInterest(context(reader), { bookId: book.id, interested: false }); expect(await models.PrintInterest.countDocuments()).toBe(0);
});
test('private PDFs are authorized, hashed by server and cannot be overwritten', async () => {
  expect((await downloadAsset(context(user), cover.id)).sha256).toBe(cover.sha256);
  await expect(downloadAsset(context(reader), cover.id)).rejects.toThrow('yetkiniz');
  await expect(uploadAsset(context(user), Buffer.from('not-pdf'), 'bad.pdf')).rejects.toThrow('PDF');
  await expect(models.PrintAsset.updateOne({ _id: cover.id }, { sha256: 'modified' })).rejects.toThrow('Değişmez');
});
test('GraphQL rejects forged user/amount/admin fields, fractional money and anonymous/private access', async () => {
  const c = await campaign();
  let result = await run('mutation($input: PrintCheckoutInput!) { startPrintCheckout(input:$input) { id } }', { input: { campaignId: c.id, idempotencyKey: randomUUID(), donationMinor: 5000, amountMinor: 1, userId: other.id } });
  expect(result.errors).toBeDefined(); expect(await models.FundingPayment.countDocuments()).toBe(0);
  result = await run('mutation($input: PrintCheckoutInput!) { startPrintCheckout(input:$input) { id } }', { input: { campaignId: c.id, idempotencyKey: randomUUID(), donationMinor: 1.2 } }); expect(result.errors).toBeDefined();
  result = await run('{ adminFundingPayments { id } }'); expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
  result = await run('{ myFundingPayments { id } }', {}, null); expect(result.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  result = await run('query($id: ID!) { printApplication(id:$id) { version { chapters { content } } } }', { id: String(c.applicationId) }, reader); expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
});

const clientSource = readFileSync(new URL('../../Client/src/graphql/printFunding.js', import.meta.url), 'utf8');
const clientTemplates = Object.fromEntries([...clientSource.matchAll(/export const (\w+) = gql`([\s\S]*?)`;/g)].map(match => [match[1], match[2]]));
const clientDocument = name => clientTemplates[name].replace(/\$\{(\w+)\}/g, (_, dependency) => clientDocument(dependency));
test('all actual frontend operations validate against the server and private/public documents execute', async () => {
  for (const [name] of Object.entries(clientTemplates).filter(([name]) => !name.endsWith('_FIELDS'))) expect(validate(schema, parse(clientDocument(name))).map(error => `${name}: ${error.message}`)).toEqual([]);
  const c = await campaign(), payment = await checkout(c, { quantity: 1, shippingAddress: address });
  for (const [name, variables, actor] of [
    ['PRINT_OVERVIEW', { bookId: book.id }, null], ['PRINT_TARIFFS', {}, null], ['AUTHOR_PRINT_WORKSPACE', { bookId: book.id }, user],
    ['PRINT_APPLICATION_DETAIL', { id: String(c.applicationId) }, user], ['ADMIN_PRINT_APPLICATIONS', { page: 1 }, admin], ['MY_FUNDING_HISTORY', { page: 1 }, reader],
    ['ADMIN_FUNDING_OPERATIONS', { page: 1 }, admin], ['ADMIN_FUNDING_CAMPAIGNS', { page: 1 }, admin], ['MY_FUNDING_PAYMENT', { id: payment.id }, reader], ['PRINT_CAMPAIGN_AUDIT', { campaignId: c.id }, user],
  ]) expect((await run(clientDocument(name), variables, actor)).errors).toBeUndefined();
  expect((await run(clientDocument('MY_FUNDING_PAYMENT'), { id: payment.id }, other)).data.myFundingPayment).toBeNull();
});
test('raw HTTP webhook and private PDF routes enforce signatures and JWT; legacy callback cannot write', async () => {
  const app = express(); app.use('/api/print', printRoutes); app.use(express.json()); app.use('/api/payment', legacyPaymentRoutes);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.JWT_SECRET = 'print-http-tests-only-jwt-key';
  const auth = actor => ({ Authorization: `Bearer ${jwt.sign({ userId: actor.id }, process.env.JWT_SECRET)}` });
  try {
    let response = await fetch(`${base}/api/print/assets/${cover.id}`); expect(response.status).toBe(401);
    response = await fetch(`${base}/api/print/assets/${cover.id}`, { headers: auth(reader) }); expect(response.status).toBe(403);
    response = await fetch(`${base}/api/print/assets/${cover.id}`, { headers: auth(user) }); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store'); expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf('kapak'));
    response = await fetch(`${base}/api/print/assets`, { method: 'POST', headers: { ...auth(user), 'Content-Type': 'application/pdf', 'X-Filename': 'test.pdf' }, body: pdf('upload') }); expect(response.status).toBe(201); expect((await response.json()).sha256).toHaveLength(64);
    const c = await campaign(), payment = await checkout(c), provider = getPaymentProvider(); const charge = await provider.simulate(payment.id, 'CAPTURED'), envelope = provider.envelope(charge);
    response = await fetch(`${base}/api/print/webhooks/sandbox`, { method: 'POST', headers: { ...envelope.headers, 'Content-Type': 'application/json' }, body: envelope.raw }); expect(response.status).toBe(200);
    response = await fetch(`${base}/api/print/webhooks/sandbox`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: envelope.raw }); expect(response.status).toBe(403);
    response = await fetch(`${base}/api/payment/callback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'untrusted', basketId: payment.id }) }); expect(response.status).toBe(410);
    expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(10000);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('lost refund response retries the same provider refund and books exactly one refund', async () => {
  const c = await campaign(), payment = await checkout(c); await capture(payment);
  await payments.requestRefund(context(admin), { paymentId: payment.id, reason: 'Test tam iade talebi.' });
  const refund = await models.FundingRefund.findOne(), provider = getPaymentProvider(), original = provider.refund.bind(provider);
  jest.spyOn(provider, 'refund').mockImplementationOnce(async input => { await original(input); throw new Error('RESPONSE_LOST_AFTER_REFUND'); });
  await payments.processRefund(refund.id); expect((await models.FundingRefund.findById(refund.id)).state).toBe('FAILED');
  expect((await provider.retrieve(payment.id)).state).toBe('REFUNDED');
  await payments.retryRefund(context(admin), refund.id); expect((await models.FundingPayment.findById(payment.id)).state).toBe('REFUNDED');
  expect(await models.FundingLedger.countDocuments({ kind: 'REFUND' })).toBe(1); expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(0);
});
test('notification delivery failure cannot roll back payment and retry does not duplicate', async () => {
  const c = await campaign(), payment = await checkout(c); await capture(payment);
  jest.spyOn(Notification, 'updateOne').mockRejectedValueOnce(new Error('NOTIFICATION_STORAGE_UNAVAILABLE'));
  await drainPrintOutbox(); expect((await models.FundingPayment.findById(payment.id)).state).toBe('CAPTURED');
  expect((await models.FundingCampaign.findById(c.id)).acceptedMinor).toBe(10000);
  await drainPrintOutbox(); await drainPrintOutbox();
  expect(await Notification.countDocuments({ dedupKey: `print:capture:${payment.id}:${reader.id}` })).toBe(1);
  await expect(models.FundingLedger.updateOne({ paymentId: payment.id }, { amountMinor: 1 })).rejects.toThrow('Değişmez');
});
test('active finance prevents unpublishing or deleting a book; explicit production cancellation refunds orders', async () => {
  let c = await campaign();
  await expect(applications.updateDigitalStatus(context(user), { bookId: book.id, status: 'DRAFT' })).rejects.toThrow('kontrollü');
  await expect(softDeleteBook(book.id)).rejects.toThrow('kontrollü');
  const payment = await checkout(c, { quantity: 1, donationMinor: 80000, shippingAddress: address }); await capture(payment); c = await campaigns.settleCampaign(c.id);
  await campaigns.updateProduction(context(admin), { campaignId: c.id, revision: c.productionRevision, state: 'CANCELLED', message: 'Test matbaa üretimi iptal edildi.' });
  await expect(softDeleteBook(book.id)).rejects.toThrow('kontrollü');
  await runPrintMaintenance(); expect((await models.FundingCampaign.findById(c.id)).state).toBe('REFUNDED'); expect((await models.PrintPreOrder.findOne()).state).toBe('REFUNDED');
});
test('migration is dry-run by default, additive, repeatable and preserves historical money and printed catalog data', async () => {
  await Book.collection.updateOne({ _id: book._id }, { $set: { status: 'FUNDING', fundingTarget: 1234.56, currentFunding: 78.9 }, $unset: { digitalStatus: 1, writingStatus: 1, kind: 1 } });
  const printed = await Book.create({ title: 'Eski basılı katalog', kind: 'PRINTED', status: 'PUBLISHED' });
  await Transaction.create({ userId: reader._id, bookId: book._id, amount: 78.9, status: 'SUCCESS', paymentProviderId: 'historical-payment' });
  expect((await migratePrintFields()).mode).toBe('DRY_RUN'); expect((await Book.collection.findOne({ _id: book._id })).digitalStatus).toBeUndefined();
  await migratePrintFields({ apply: true }); await migratePrintFields({ apply: true });
  const migrated = await Book.collection.findOne({ _id: book._id }); expect(migrated).toMatchObject({ status: 'FUNDING', digitalStatus: 'PUBLISHED', writingStatus: 'COMPLETED', fundingTarget: 1234.56, currentFunding: 78.9 });
  expect((await Book.collection.findOne({ _id: printed._id })).digitalStatus).toBeUndefined();
  expect((await Transaction.findOne()).amount).toBe(78.9); expect(await models.FundingLedger.countDocuments()).toBe(0);
});
test('encrypted address is never plaintext in storage; tampering or another payment AAD is rejected', async () => {
  const c = await campaign(), payment = await checkout(c, { quantity: 1, shippingAddress: address });
  const stored = await models.PrintPreOrder.collection.findOne({ paymentId: payment._id });
  expect(JSON.stringify(stored.shippingAddress)).not.toContain(address.line); expect(stored.shippingAddress.version).toBe(1);
  expect(decryptAddress(stored.shippingAddress, payment.id).line).toBe(address.line);
  expect(() => decryptAddress(stored.shippingAddress, 'different-payment')).toThrow('bütünlük');
  expect(() => decryptAddress({ ...stored.shippingAddress, ciphertext: Buffer.from('tampered').toString('base64') }, payment.id)).toThrow('bütünlük');
  const key = process.env.PRINT_ADDRESS_ENCRYPTION_KEY; process.env.PRINT_ADDRESS_ENCRYPTION_KEY = '';
  try { await expect(checkout(c, { quantity: 1, shippingAddress: address })).rejects.toThrow('şifreleme anahtarı'); }
  finally { process.env.PRINT_ADDRESS_ENCRYPTION_KEY = key; }
  expect(await models.FundingPayment.countDocuments()).toBe(1); expect((await models.FundingCampaign.findById(c.id)).reservedMinor).toBe(payment.amountMinor);
});
test('an expiry before provider initialization safely frees capacity without manufacturing a provider payment', async () => {
  const c = await campaign(), provider = getPaymentProvider();
  jest.spyOn(provider, 'initialize').mockRejectedValueOnce(new Error('PROVIDER_UNAVAILABLE_BEFORE_REQUEST'));
  await expect(checkout(c)).rejects.toThrow('PROVIDER_UNAVAILABLE');
  const payment = await models.FundingPayment.findOne();
  await models.PaymentReservation.updateOne({ paymentId: payment._id }, { expiresAt: new Date(Date.now() - 1000) });
  const report = await runPrintMaintenance(); expect(report.errors).toEqual([]);
  expect((await models.FundingCampaign.findById(c.id)).reservedMinor).toBe(0); expect(await models.SandboxCharge.countDocuments()).toBe(0);
  expect((await models.FundingPayment.findById(payment.id)).state).toBe('CANCELLED');
});
test('historical PUBLISHED mutation preserves one publication point award and still cannot open funding', async () => {
  await bookResolvers.Mutation.updateBookStatus(null, { bookId: book.id, status: 'PUBLISHED' }, context(user));
  await bookResolvers.Mutation.updateBookStatus(null, { bookId: book.id, status: 'PUBLISHED' }, context(user));
  expect(await PointEvent.countDocuments({ userId: user._id, action: 'publish', sourceId: book.id })).toBe(1);
  expect((await UserScore.findOne({ userId: user._id })).totalPoints).toBe(50); expect(await models.FundingCampaign.countDocuments()).toBe(0);
});
test('real migration CLI dry-run on an empty test database creates neither collections nor indexes', async () => {
  const databaseName = 'print_migration_readonly';
  const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../src/scripts/migratePrintFunding.js', import.meta.url))], { env: { ...process.env, MONGO_URI: getTestDatabaseUri(databaseName) }, timeout: 30000 });
  expect(JSON.parse(stdout)).toMatchObject({ mode: 'DRY_RUN', digitalBooks: 0, legacyPendingPayments: 0 });
  expect(await mongoose.connection.getClient().db(databaseName).listCollections().toArray()).toEqual([]);
});

async function withProductionTariffSettings(flag, operation) {
  const names = ['NODE_ENV', 'PRINT_SYSTEM_ENABLED', 'PRINT_PAYMENTS_MODE', 'PRINT_SANDBOX_WEBHOOK_SECRET', 'PRINT_ADDRESS_ENCRYPTION_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    for (const name of names.slice(1)) delete process.env[name];
    if (flag !== undefined) process.env.PRINT_SYSTEM_ENABLED = flag;
    await operation();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test.each([undefined, 'false'])('production admins can prepare tariffs with PRINT_SYSTEM_ENABLED=%s while funding stays disabled', async flag => {
  await withProductionTariffSettings(flag, async () => {
    const initialize = jest.spyOn(models.PrintTariff, 'createIndexes');
    const result = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: { ...tariffInput, version: 'production-preparation-v1' } }, admin);
    expect(result.errors).toBeUndefined();
    const created = result.data.createPrintTariff;
    expect(created).toMatchObject({ version: 'production-preparation-v1', environment: 'SANDBOX' });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(await models.PrintAudit.countDocuments({ entityId: created.id, action: 'TARIFF_CREATED', actorId: admin._id })).toBe(1);
    expect((await run('{ printPaymentMode }')).data.printPaymentMode).toBe('DISABLED');
    expect(() => getPaymentProvider()).toThrow('Ödemeler kapalı');
    for (const [name, variables] of [
      ['SET_PRINT_INTEREST', { bookId: book.id, interested: true }],
      ['START_PRINT_CHECKOUT', { input: { campaignId: book.id, idempotencyKey: randomUUID(), donationMinor: 5000 } }],
      ['OPEN_FUNDING_CAMPAIGN', { input: { applicationId: book.id, revision: 1 } }],
      ['RUN_PRINT_MAINTENANCE', {}],
    ]) expect((await run(clientDocument(name), variables, admin)).errors[0].extensions.code).toBe('PRINT_SYSTEM_DISABLED');
    expect(await models.FundingCampaign.countDocuments()).toBe(0); expect(await models.FundingPayment.countDocuments()).toBe(0);
    expect(await models.FundingLedger.countDocuments()).toBe(0); expect(await models.SandboxCharge.countDocuments()).toBe(0);
  });
});

test('production tariff access still checks the current admin role and input bounds', async () => {
  await withProductionTariffSettings(undefined, async () => {
    for (const viewer of [null, reader]) {
      const result = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: { ...tariffInput, version: 'forbidden-version' } }, viewer);
      expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
    }
    const invalid = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: { ...tariffInput, version: 'invalid-price', pageRates: { ...tariffInput.pageRates, enzo: -1 } } }, admin);
    expect(invalid.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    await User.updateOne({ _id: admin._id }, { role: 'USER' });
    const stale = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: { ...tariffInput, version: 'stale-admin' } }, admin);
    expect(stale.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(await models.PrintTariff.countDocuments()).toBe(1);
  });
});

test('a duplicate tariff version returns an actionable conflict and cannot duplicate its audit', async () => {
  await withProductionTariffSettings(undefined, async () => {
    const result = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: tariffInput }, admin);
    expect(result.errors[0].extensions.code).toBe('CONFLICT');
    expect(result.errors[0].message).toContain('farklı bir sürüm adı');
    expect(await models.PrintTariff.countDocuments({ version: tariffInput.version })).toBe(1);
    expect(await models.PrintAudit.countDocuments({ entityId: tariff._id, action: 'TARIFF_CREATED' })).toBe(1);
  });
});

test('tariff creation explains missing transaction support without saving an unaudited record', async () => {
  await withProductionTariffSettings(undefined, async () => {
    jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue({ command: async () => ({ ok: 1 }) });
    const result = await run(clientDocument('CREATE_PRINT_TARIFF'), { input: { ...tariffInput, version: 'standalone-rejected' } }, admin);
    expect(result.errors[0].extensions.code).toBe('PRINT_STORAGE_UNAVAILABLE');
    expect(result.errors[0].message).toContain('replica set');
    expect(await models.PrintTariff.countDocuments({ version: 'standalone-rejected' })).toBe(0);
  });
});
