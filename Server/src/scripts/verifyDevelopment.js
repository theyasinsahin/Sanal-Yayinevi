import '../config/environment.js';
import mongoose from 'mongoose';
import { assertDockerDevelopment } from '../config/dockerDevelopment.js';
import { getClassificationOptions } from '../services/classificationService.js';
import Badge from '../models/badge.js';
import User from '../models/user.js';
import Book from '../models/book.js';
import { PrintTariff } from '../models/printFunding.js';

try {
  assertDockerDevelopment();
  await mongoose.connect(process.env.MONGO_URI);
  const options = await getClassificationOptions();
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const checks = {
    replicaSet: Boolean(hello.setName || hello.msg === 'isdbgrid'),
    formats: options.formats.length,
    genres: options.genres.length,
    narrativeFeatures: options.narrativeFeatures.length,
    targetAudiences: options.targetAudiences.length,
    contentWarnings: options.contentWarnings.length,
    badges: await Badge.countDocuments(),
    adminAccount: Boolean(await User.exists({ email: 'admin@betik-dev.invalid', role: 'ADMIN', isActive: true, isDeleted: false })),
    sandboxTariff: Boolean(await PrintTariff.exists({ environment: 'SANDBOX' })),
    missingBookDescriptions: await Book.countDocuments({ isDeleted: false, description: null }),
  };
  const ready = checks.replicaSet && checks.formats > 0 && checks.genres > 0 && checks.badges > 0
    && checks.adminAccount && checks.sandboxTariff && checks.missingBookDescriptions === 0;
  console.log(JSON.stringify({ database: 'betik_dev', ready, checks }, null, 2));
  if (!ready) {
    console.error('Yerel başlangıç verileri eksik. ./dev seed çalıştırın; yönetici tarafından pasifleştirilen kayıtları ayrıca inceleyin.');
    process.exitCode = 1;
  }
} catch {
  console.error('Yerel veritabanı doğrulanamadı. Önce ./dev doctor ve ./dev up çalıştırın.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
