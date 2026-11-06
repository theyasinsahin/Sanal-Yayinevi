import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEditorialManifest } from '../utils/printedEditorial.js';

// Validation is offline. A database URI is never loaded from .env by this CLI.
const args = process.argv.slice(2), values = new Map(), switches = new Set();
try {
  for (let i = 0; i < args.length; i++) {
    if (['--manifest', '--report', '--database', '--admin-id', '--expected-sha256'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--') && !values.has(args[i])) values.set(args[i], args[++i]);
    else if (['--check-db', '--apply', '--allow-remote'].includes(args[i]) && !switches.has(args[i])) switches.add(args[i]);
    else throw new Error('Geçersiz veya yinelenen komut seçeneği.');
  }
  const path = values.get('--manifest') || fileURLToPath(new URL('../data/printed-catalog/tr-editorial-2026-11-06.json', import.meta.url));
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  let report = { ...validateEditorialManifest(manifest), mode: 'validate', databaseAccessed: false };
  if (switches.has('--check-db') || switches.has('--apply')) {
    const uri = process.env.PRINTED_EDITORIAL_MONGO_URI, database = values.get('--database');
    if (!uri || !/^[\w-]+$/u.test(database || '')) throw new Error('Açık PRINTED_EDITORIAL_MONGO_URI ve --database gerekli.');
    const authority = uri.match(/^mongodb(?:\+srv)?:\/\/([^/?]+)/u)?.[1]?.split('@').at(-1);
    if (!authority) throw new Error('Geçersiz MongoDB bağlantısı.');
    const local = authority.split(',').every(host => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(host));
    if (!local && !switches.has('--allow-remote')) throw new Error('Uzak bağlantı için --allow-remote gerekli.');
    if (switches.has('--apply') && (!mongoose.isObjectIdOrHexString(values.get('--admin-id')) || values.get('--expected-sha256') !== report.sha256)) throw new Error('Aktif --admin-id ve incelenen --expected-sha256 gerekli.');
    await mongoose.connect(uri, { dbName: database, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const { applyPrintedEditorial } = await import('../services/printedEditorialService.js');
    if (switches.has('--apply')) {
      await (await import('../utils/adminAccess.js')).requireAdmin({ user: { id: values.get('--admin-id') } });
      // Preflight precedes all index/collection writes.
      const preview = await applyPrintedEditorial(manifest);
      if (preview.conflicts.length) throw new Error(`Katalogda ${preview.conflicts.length} çakışma var; önce yeni inceleme gerekli.`);
      await (await import('../models/printedEditorialRecord.js')).default.createIndexes();
      const Book = (await import('../models/book.js')).default;
      await Book.collection.createIndex({ kind: 1, publicationStatus: 1, isDeleted: 1, recognitionScore: -1, createdAt: -1, _id: -1 });
    }
    report = { ...await applyPrintedEditorial(manifest, { apply: switches.has('--apply'), adminId: values.get('--admin-id'), expectedSha256: values.get('--expected-sha256') }), databaseAccessed: true, database };
    if (report.conflicts.length) process.exitCode = 2;
  }
  const output = resolve(values.get('--report') || fileURLToPath(new URL(`../../printed-editorial-report-${Date.now()}.json`, import.meta.url)));
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ...report, report: output }, null, 2));
} catch (error) {
  console.error(error.name?.startsWith('Mongo') || error.name?.startsWith('Mongoose') ? 'Veritabanı işlemi tamamlanamadı; bağlantıyı ve günlükleri güvenli ortamda kontrol edin.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
