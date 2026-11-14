import '../config/environment.js';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import { assertDockerDevelopment } from '../config/dockerDevelopment.js';
import { seedDevelopmentReferenceData } from '../services/developmentReferenceData.js';

export const developmentIds = {
  admin: '000000000000000000000101',
  author: '000000000000000000000102',
  reader: '000000000000000000000103',
  publisher: '000000000000000000000104',
  story: '000000000000000000000201',
  draft: '000000000000000000000202',
  printed: '000000000000000000000203',
};

export async function seedDevelopmentData(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('A stable development-only password of at least 12 characters is required.');
  await Promise.all([User.init(), Book.init(), Chapter.init()]);
  const options = await seedDevelopmentReferenceData();
  const classification = {
    formatId: options.formats.find(term => term.slug === 'oyku')?.id || options.formats[0].id,
    genreIds: [options.genres.find(genre => genre.slug === 'macera')?.id || options.genres[0].id],
    classificationStatus: 'COMPLETE', classificationVersion: 1,
  };
  const hashed = await bcrypt.hash(password, 10);
  const createdAt = new Date();
  for (const [name, role] of [['admin', 'ADMIN'], ['author', 'USER'], ['reader', 'USER'], ['publisher', 'PUBLISHER']]) {
    await User.updateOne({ _id: developmentIds[name] }, { $setOnInsert: {
      username: 'dev_' + name, fullName: 'Docker ' + name, email: name + '@betik-dev.invalid',
      password: hashed, role, isVerified: true, isActive: true, createdAt, updatedAt: createdAt,
      ...(name === 'author' ? { usersBooks: [developmentIds.story, developmentIds.draft] } : {}),
    } }, { upsert: true, runValidators: true, timestamps: false });
  }
  const chapters = [1, 2, 3, 4].map(n => '00000000000000000000030' + n);
  await Book.updateOne({ _id: developmentIds.story }, { $setOnInsert: {
    title: 'Docker Örnek Hikâye', authorId: developmentIds.author, createdAt, updatedAt: createdAt,
    description: 'Yalnız yerel geliştirme için oluşturulmuş örnek kitap.',
    ...classification,
    status: 'WRITING', digitalStatus: 'PUBLISHED', writingStatus: 'WRITING',
    chapters, pageCount: 3,
  } }, { upsert: true, runValidators: true, timestamps: false });
  for (let i = 0; i < chapters.length; i++) {
    await Chapter.updateOne({ _id: chapters[i] }, { $setOnInsert: {
      bookId: developmentIds.story, authorId: developmentIds.author,
      title: i === 0 ? 'Gizli örnek bölüm' : 'Örnek bölüm ' + i,
      content: '<p>Bu metin yalnız yerel geliştirme verisidir.</p><p>Okuma, yorum ve alıntı işlemlerini burada deneyebilirsiniz.</p>',
      isHidden: i === 0, pageCount: 1, createdAt: new Date(Date.UTC(2020, 0, i + 1)), updatedAt: createdAt,
    } }, { upsert: true, runValidators: true, timestamps: false });
  }
  await Book.updateOne({ _id: developmentIds.draft }, { $setOnInsert: {
    title: 'Docker Taslak Kitap', authorId: developmentIds.author, createdAt, updatedAt: createdAt,
    description: 'Bölüm ekleme ve yayınlama denemeleri için yerel taslak.',
    ...classification,
    status: 'DRAFT', digitalStatus: 'DRAFT', writingStatus: 'WRITING',
  } }, { upsert: true, runValidators: true, timestamps: false });
  await Book.updateOne({ _id: developmentIds.printed }, { $setOnInsert: {
    title: 'Docker Basılı Kitap Örneği', kind: 'PRINTED', status: 'PUBLISHED', createdAt, updatedAt: createdAt,
    publicationStatus: 'APPROVED', printedAuthor: 'Örnek Yazar', publisher: 'Örnek Yayıncı',
    description: 'Gerçek satış veya teslimat sunmayan geliştirme örneği.', pageCount: 100,
  } }, { upsert: true, runValidators: true, timestamps: false });
  // Repair only the missing non-null field in the old built-in draft fixture.
  // Existing user-entered descriptions, including an empty string, are preserved.
  await Book.updateOne({ _id: developmentIds.draft, description: null }, {
    $set: { description: 'Bölüm ekleme ve yayınlama denemeleri için yerel taslak.' },
  }, { timestamps: false });
  return { users: 4, books: 3, chapters: 4 };
}

async function main() {
  assertDockerDevelopment();
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const summary = await seedDevelopmentData(process.env.DEV_SEED_PASSWORD);
    const { initializePrintFunding } = await import('../services/print/common.js');
    const { PrintTariff } = await import('../models/printFunding.js');
    const { createTariff } = await import('../services/print/applicationService.js');
    await initializePrintFunding();
    // Preserve any tariff created or edited by the developer.
    if (!await PrintTariff.exists({})) {
      const admin = await User.findById(developmentIds.admin);
      await createTariff({ user: admin }, {
        version: 'docker-development-v1', label: 'DOCKER ÖRNEĞİ — gerçek matbaa teklifi değildir',
        pageRates: { enzo: 10, ivory: 15, coated: 20 }, coverRates: { paperback: 1000, hardcover: 2000 },
        dimensionBps: { '13.5x21': 10000, '16x24': 12000 }, colorBps: 20000,
        setupMinor: 10000, packagingPerUnitMinor: 1000, shippingPerUnitMinor: 1000,
        serviceMinor: 10000, taxBps: 2000, feeBps: 500,
        policy: { donationMinMinor: 5000, donationMaxMinor: 10000000, quickAmountsMinor: [5000, 10000, 25000, 50000],
          campaignDays: 30, reservationMinutes: 15, maxOrderQuantity: 10 },
      });
    }
    const { samplePdf } = await import('./printSandboxSupport.js');
    const directory = resolve('artifacts/development');
    await mkdir(directory, { recursive: true });
    for (const name of ['cover', 'layout', 'quote']) {
      const file = resolve(directory, name + '.pdf');
      try { await access(file); } catch { await writeFile(file, samplePdf('Docker sample ' + name), { flag: 'wx' }); }
    }
    console.log(JSON.stringify({ ...summary, database: 'betik_dev', passwordPrinted: false }));
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => { console.error('Development seed failed. Check the isolated local configuration.'); process.exitCode = 1; });
}
