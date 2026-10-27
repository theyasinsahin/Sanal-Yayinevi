import Book from '../../models/book.js';
import Chapter from '../../models/chapter.js';
import User from '../../models/user.js';
import { BookPrintVersion, PrintApplication, PrintTariff, PrintAsset, FundingCampaign, PrintInterest, PrintAudit } from '../../models/printFunding.js';
import { actor, owner, fail, id, int, text, hash, transact, audit, notice, page, initializePrintTariffManagement } from './common.js';

export const digitalState = book => book.digitalStatus || (book.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
export const writingState = book => book.writingStatus || (['COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'].includes(book.status) ? 'COMPLETED' : 'WRITING');
export async function updateDigitalStatus(context, { bookId, status, fundingTarget, printConfig }) {
  if (fundingTarget != null || printConfig != null || !['DRAFT', 'WRITING', 'COMPLETED', 'PUBLISHED'].includes(status)) throw fail('Fon ve basım durumu yalnızca onaylı basım akışından yönetilir.');
  return transact(async session => {
    const user = await actor(context, session);
    const book = await Book.findOne({ _id: id(bookId), isDeleted: false }).session(session);
    if (!book) throw fail('Dijital kitap bulunamadı.');
    if (book.kind === 'PRINTED') throw fail('Basılı kitaplar fonlama ve taslak akışına alınamaz.');
    if (String(book.authorId) !== String(user._id) && user.role !== 'ADMIN') throw fail('Yetkiniz yok.', 'FORBIDDEN');
    if (status === 'DRAFT' && await FundingCampaign.exists({ bookId: book._id, $or: [{ activeLock: true }, { state: 'REFUNDING' }, { state: 'SUCCEEDED', productionState: { $nin: ['COMPLETED', 'CANCELLED'] } }] }).session(session)) throw fail('Aktif kampanya/üretim varken kitabı taslağa çekemezsiniz. Önce kontrollü iptal sürecini yürütün.');
    const from = `${digitalState(book)}/${writingState(book)}`;
    book.digitalStatus = digitalState(book); book.writingStatus = writingState(book);
    if (status === 'COMPLETED') {
      const chapters = await Chapter.find({ bookId, isDeleted: false }).session(session).lean();
      if (!chapters.some(chapter => plainText(chapter.content).trim())) throw fail('Kitabı tamamlamak için metin içeren bir bölüm gerekli.');
      book.writingStatus = 'COMPLETED'; book.completedAt = new Date();
    } else if (status === 'DRAFT') book.digitalStatus = 'DRAFT';
    else book.digitalStatus = 'PUBLISHED';
    // Keep legacy readers working, without ever starting a campaign.
    book.status = book.digitalStatus === 'DRAFT' ? 'DRAFT' : book.writingStatus === 'COMPLETED' ? 'COMPLETED' : 'WRITING';
    await book.save({ session });
    await audit(session, user._id, book._id, 'DIGITAL_STATUS', from, `${book.digitalStatus}/${book.writingStatus}`);
    return book;
  });
}
const plainText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot|#\d+);/g, ' ');
const sum = values => int(values.reduce((a, b) => a + b, 0), 'Toplam');
const bps = (amount, rate) => Number((BigInt(amount) * BigInt(rate) + 9999n) / 10000n);

export async function createTariff(context, input) {
  const user = await actor(context, null, true);
  const config = { version: text(input.version, 'Tarife sürümü', 1, 80), label: text(input.label, 'Örnek tarife açıklaması', 5, 200), environment: 'SANDBOX', createdBy: user._id };
  for (const [key, choices] of Object.entries({ pageRates: ['enzo', 'ivory', 'coated'], coverRates: ['paperback', 'hardcover'], dimensionBps: ['13.5x21', '16x24'] })) {
    config[key] = Object.fromEntries(choices.map(choice => [choice, int(input[key]?.[choice], `${key}/${choice}`, key === 'dimensionBps' ? 1 : 0, 1000000)]));
  }
  for (const key of ['colorBps', 'setupMinor', 'packagingPerUnitMinor', 'shippingPerUnitMinor', 'serviceMinor', 'taxBps', 'feeBps']) config[key] = int(input[key], key, 0, key.endsWith('Bps') ? 100000 : 100000000);
  const policy = input.policy || {};
  config.policy = {
    donationMinMinor: int(policy.donationMinMinor, 'Minimum destek', 1, 10000000), donationMaxMinor: int(policy.donationMaxMinor, 'Maksimum destek', 1, 100000000),
    campaignDays: int(policy.campaignDays ?? 30, 'Kampanya süresi', 1, 90), reservationMinutes: int(policy.reservationMinutes ?? 15, 'Rezervasyon süresi', 1, 60), maxOrderQuantity: int(policy.maxOrderQuantity ?? 10, 'Sipariş sınırı', 1, 100),
  };
  if (config.policy.donationMaxMinor < config.policy.donationMinMinor || !Array.isArray(policy.quickAmountsMinor) || policy.quickAmountsMinor.length > 10) throw fail('Destek sınırları veya hızlı tutarlar geçersiz.');
  config.policy.quickAmountsMinor = [...new Set(policy.quickAmountsMinor.map(amount => int(amount, 'Hızlı destek', config.policy.donationMinMinor, config.policy.donationMaxMinor)))];
  await initializePrintTariffManagement();
  try {
    return await transact(async session => {
      await actor(context, session, true);
      const [tariff] = await PrintTariff.create([config], { session });
      await audit(session, user._id, tariff._id, 'TARIFF_CREATED', '', tariff.version, 'SANDBOX örnek fiyat tarifesi'); return tariff;
    });
  } catch (error) {
    if (error.code === 11000) throw fail('Bu tarife sürümü zaten var. Yeni tarife için farklı bir sürüm adı girin.', 'CONFLICT');
    throw error;
  }
}
function specification(input) {
  const result = { dimension: input.dimension, paperType: input.paperType, coverType: input.coverType, color: input.color, printRun: int(input.printRun, 'Baskı adedi', 1, 100000), coverAssetId: String(id(input.coverAssetId)), coverDpi: int(input.coverDpi, 'Kapak DPI', 300, 2400), bleedMm: int(input.bleedMm, 'Taşma payı (mm)', 3, 20), notes: text(input.notes || '-', 'Ek tercihler', 1, 2000) };
  if (!['13.5x21', '16x24'].includes(result.dimension) || !['enzo', 'ivory', 'coated'].includes(result.paperType) || !['paperback', 'hardcover'].includes(result.coverType) || !['BW', 'COLOR'].includes(result.color)) throw fail('Geçerli baskı özellikleri seçin.');
  return result;
}
async function snapshot(book, user, input, session) {
  const spec = specification(input.specification);
  const asset = await PrintAsset.findById(spec.coverAssetId).session(session);
  if (!asset || String(asset.ownerId) !== String(user._id)) throw fail('Size ait kapak PDF dosyası gerekli.');
  const declarations = input.declarations;
  if (!declarations || ['copyright', 'permissions', 'terms'].some(key => declarations[key] !== true)) throw fail('Eser sahipliği, izin ve basım koşulları onaylanmalı.');
  const chapters = (await Chapter.find({ bookId: book._id, isDeleted: false }).sort({ createdAt: 1, _id: 1 }).session(session).lean()).map(chapter => ({ sourceId: String(chapter._id), title: chapter.title || '', content: chapter.content || '' }));
  const words = chapters.map(chapter => plainText(chapter.content)).join(' ').trim().split(/\s+/u).filter(Boolean).length;
  if (!words || Buffer.byteLength(JSON.stringify(chapters)) > 8000000) throw fail('Basım metni boş veya 8 MB sınırını aşıyor.');
  const body = { bookId: String(book._id), authorId: String(book.authorId), title: book.title, authorName: user.fullName, chapters, specification: { ...spec, coverSha256: asset.sha256 }, declarations: { copyright: true, permissions: true, terms: true, termsVersion: 'print-sandbox-v1', acceptedAt: new Date().toISOString() } };
  const [version] = await BookPrintVersion.create([{ ...body, contentHash: hash(body), wordCount: words, estimatedPages: Math.ceil(words / (spec.dimension === '16x24' ? 350 : 250)) }], { session });
  return version;
}
function estimate(version, tariff) {
  const spec = version.specification;
  const unit = bps(bps(version.estimatedPages * tariff.pageRates[spec.paperType], tariff.dimensionBps[spec.dimension]), spec.color === 'COLOR' ? tariff.colorBps : 10000) + tariff.coverRates[spec.coverType];
  const costs = { printingMinor: sum([unit * spec.printRun, tariff.setupMinor]), shippingMinor: tariff.shippingPerUnitMinor * spec.printRun, packagingMinor: tariff.packagingPerUnitMinor * spec.printRun, serviceMinor: tariff.serviceMinor, otherMinor: 0 };
  costs.taxMinor = bps(sum(Object.values(costs)), tariff.taxBps);
  costs.providerFeeMinor = bps(sum(Object.values(costs)), tariff.feeBps);
  return { environment: 'SANDBOX', label: 'ÖRNEK — matbaa teklifi değildir', tariffVersion: tariff.version, estimatedPages: version.estimatedPages, components: costs, totalMinor: sum(Object.values(costs)) };
}
export async function saveApplication(context, input) {
  try { return await transact(async session => {
    const user = await actor(context, session);
    const book = await Book.findOne({ _id: id(input.bookId), isDeleted: false, kind: { $ne: 'PRINTED' } }).session(session);
    if (!book) throw fail('Dijital kitap bulunamadı.'); owner(book, user);
    if (writingState(book) !== 'COMPLETED' || digitalState(book) !== 'PUBLISHED') throw fail('Başvuru için kitap dijital yayımlanmış ve tamamlanmış olmalı.');
    let application = await PrintApplication.findOne({ bookId: book._id, open: true }).session(session);
    if (application && (!['PREPARING', 'REVISION_REQUESTED'].includes(application.state) || application.revision !== input.revision)) throw fail('Başvuru değişmiş veya bu aşamada düzenlenemez.', 'CONFLICT');
    const tariff = await PrintTariff.findById(id(input.tariffId)).session(session);
    if (!tariff) throw fail('Geçerli örnek tarife seçin.');
    // A book write serializes application creation with publication changes.
    await Book.updateOne({ _id: book._id }, { $inc: { printRevision: 1 } }, { session });
    const version = await snapshot(book, user, input, session);
    const from = application?.state || '';
    if (!application) application = new PrintApplication({ bookId: book._id, authorId: user._id });
    else application.previousVersionIds.push(application.versionId);
    application.versionId = version._id; application.tariffId = tariff._id; application.estimate = estimate(version, tariff); application.state = 'PREPARING'; application.revision += 1;
    application.verifiedQuote = undefined; application.approvedTargetMinor = 0; application.approvedUnitPriceMinor = 0;
    await application.save({ session });
    await audit(session, user._id, application._id, 'APPLICATION_SAVED', from, 'PREPARING', '', { versionId: version.id, hash: version.contentHash }); return application;
  }); } catch (error) { if (error.code === 11000) throw fail('Kitap için açık başvuru zaten var.', 'CONFLICT'); throw error; }
}
export async function submitApplication(context, { applicationId, revision }) {
  return transact(async session => {
    const user = await actor(context, session), application = await PrintApplication.findById(id(applicationId)).session(session);
    if (!application) throw fail('Başvuru bulunamadı.'); owner(application, user);
    if (application.state !== 'PREPARING' || application.revision !== revision) throw fail('Başvuru gönderime hazır değil veya değişmiş.', 'CONFLICT');
    const book = await Book.findOne({ _id: application.bookId, isDeleted: false }).session(session);
    if (!book || digitalState(book) !== 'PUBLISHED' || writingState(book) !== 'COMPLETED') throw fail('Kitap yayımlanmış ve tamamlanmış olmalı.');
    await Book.updateOne({ _id: book._id }, { $inc: { printRevision: 1 } }, { session });
    application.state = 'SUBMITTED'; application.submittedAt = new Date(); application.revision += 1; await application.save({ session });
    await audit(session, user._id, application._id, 'APPLICATION_SUBMITTED', 'PREPARING', 'SUBMITTED');
    await notice(session, `submitted:${application.id}:${application.revision}`, user._id, 'Basım başvurusu gönderildi', 'Başvurunuz yönetici incelemesinde.'); return application;
  });
}
export async function reviewApplication(context, input) {
  return transact(async session => {
    const user = await actor(context, session, true), application = await PrintApplication.findById(id(input.applicationId)).session(session);
    if (!application || application.state !== 'SUBMITTED' || application.revision !== input.revision) throw fail('Başvuru incelemede değil veya değişmiş.', 'CONFLICT');
    if (String(application.authorId) === String(user._id)) throw fail('Kendi başvurunuzu onaylayamazsınız.', 'FORBIDDEN');
    const decision = input.decision;
    if (!['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(decision)) throw fail('Geçerli karar seçin.');
    const reason = text(input.reason, 'İnceleme gerekçesi', 5, 2000);
    if (decision === 'APPROVED') {
      const quote = input.quote, version = await BookPrintVersion.findById(application.versionId).session(session);
      if (!quote || quote.preflightConfirmed !== true) throw fail('Mizanpaj ve dosya teknik kontrolü onaylanmalı.');
      const layoutAsset = await PrintAsset.findById(id(quote.layoutAssetId)).session(session);
      const quoteAsset = await PrintAsset.findById(id(quote.quoteAssetId)).session(session);
      if (!layoutAsset || !quoteAsset || [layoutAsset, quoteAsset].some(asset => ![String(user._id), String(application.authorId)].includes(String(asset.ownerId)))) throw fail('Yetkili mizanpaj ve matbaa teklif PDF dosyaları gerekli.');
      const components = Object.fromEntries(['printingMinor', 'shippingMinor', 'packagingMinor', 'taxMinor', 'providerFeeMinor', 'serviceMinor', 'otherMinor'].map(key => [key, int(quote.components?.[key], key)]));
      const sale = Object.fromEntries(['unitProductionMinor', 'unitShippingMinor', 'unitPackagingMinor', 'unitTaxMinor', 'unitFeeMinor', 'unitServiceMinor', 'unitMarginMinor'].map(key => [key, int(quote.sale?.[key], key)]));
      for (const [unit, total] of [['unitProductionMinor', 'printingMinor'], ['unitShippingMinor', 'shippingMinor'], ['unitPackagingMinor', 'packagingMinor'], ['unitTaxMinor', 'taxMinor'], ['unitFeeMinor', 'providerFeeMinor'], ['unitServiceMinor', 'serviceMinor']]) {
        if (sale[unit] < Math.ceil(components[total] / version.specification.printRun)) throw fail('Satış fiyatı doğrulanmış birim üretim ve operasyon maliyetlerini karşılamalı.');
      }
      const target = sum(Object.values(components)), price = sum(Object.values(sale));
      int(target, 'Hedef', 1); int(price, 'Birim fiyat', 1);
      application.verifiedQuote = { environment: 'SANDBOX', source: text(quote.source, 'Teklif referansı', 5, 300), confirmedPages: int(quote.confirmedPages, 'Doğrulanmış mizanpaj sayfası', 1, 20000), layoutAssetId: layoutAsset.id, layoutSha256: layoutAsset.sha256, quoteAssetId: quoteAsset.id, quoteSha256: quoteAsset.sha256, preflightConfirmed: true, components, sale, totalMinor: target, unitPriceMinor: price, verifiedAt: new Date().toISOString(), verifiedBy: user.id };
      application.approvedTargetMinor = target; application.approvedUnitPriceMinor = price;
    }
    application.state = decision; application.open = decision !== 'REJECTED'; application.reviewNote = reason; application.reviewedBy = user._id; application.reviewedAt = new Date(); application.revision += 1;
    await application.save({ session });
    await audit(session, user._id, application._id, 'APPLICATION_REVIEW', 'SUBMITTED', decision, reason, { targetMinor: application.approvedTargetMinor, unitPriceMinor: application.approvedUnitPriceMinor });
    await notice(session, `review:${application.id}:${application.revision}`, application.authorId, 'Basım başvurusu kararı', `${decision}: ${reason}`); return application;
  });
}
export async function cancelApplication(context, { applicationId, revision, reason }) {
  return transact(async session => {
    const user = await actor(context, session), application = await PrintApplication.findById(id(applicationId)).session(session);
    if (!application) throw fail('Başvuru bulunamadı.'); owner(application, user);
    if (!['PREPARING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED'].includes(application.state) || application.revision !== revision || await FundingCampaign.exists({ applicationId: application._id }).session(session)) throw fail('Başvuru bu aşamada iptal edilemez.', 'CONFLICT');
    const from = application.state; application.state = 'CANCELLED'; application.open = false; application.revision += 1; await application.save({ session });
    await audit(session, user._id, application._id, 'APPLICATION_CANCELLED', from, 'CANCELLED', text(reason, 'İptal gerekçesi', 5)); return application;
  });
}
export async function applications(context, { admin = false, page: p = 1 } = {}) {
  const user = await actor(context, null, admin);
  return PrintApplication.find(admin ? {} : { authorId: user._id }).sort({ createdAt: -1, _id: -1 }).skip((page(p) - 1) * 20).limit(20).exec();
}
export async function privateApplication(context, applicationId) {
  const user = await actor(context), application = await PrintApplication.findById(id(applicationId)).exec();
  if (!application) throw fail('Başvuru bulunamadı.');
  if (user.role !== 'ADMIN') owner(application, user);
  return application;
}
export async function applicationHistory(context, applicationId) { await privateApplication(context, applicationId); return PrintAudit.find({ entityId: applicationId }).sort({ createdAt: 1, _id: 1 }).limit(200).exec(); }
export async function applicationVersions(context, applicationId) {
  const application = await privateApplication(context, applicationId);
  return BookPrintVersion.find({ _id: { $in: [...application.previousVersionIds, application.versionId] } }).sort({ createdAt: 1, _id: 1 }).exec();
}
export async function setInterest(context, { bookId, interested }) {
  const user = await actor(context), book = await Book.findOne({ _id: id(bookId), isDeleted: false, kind: { $ne: 'PRINTED' } }).exec();
  if (!book || digitalState(book) !== 'PUBLISHED') throw fail('Yayımlanmış dijital kitap gerekli.');
  if (!await User.exists({ _id: book.authorId, isDeleted: false, isActive: { $ne: false } })) throw fail('Yazar hesabı erişilebilir değil.');
  if (interested) { try { await PrintInterest.updateOne({ bookId, userId: user._id }, { $setOnInsert: { bookId, userId: user._id } }, { upsert: true }); } catch (error) { if (error.code !== 11000) throw error; } }
  else await PrintInterest.deleteOne({ bookId, userId: user._id });
  return true;
}
