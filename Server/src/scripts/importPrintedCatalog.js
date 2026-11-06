import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePrintedCatalog } from '../utils/printedCatalog.js';

// No dotenv import: validation must never discover a production connection.
const args = process.argv.slice(2);
const values = new Map(), switches = new Set();
const valueFlags = ['--manifest', '--report', '--admin-id', '--expected-sha256', '--database'];
const switchFlags = ['--check-db', '--apply', '--allow-remote'];
try {
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--') && !values.has(args[i])) values.set(args[i], args[++i]);
    else if (switchFlags.includes(args[i]) && !switches.has(args[i])) switches.add(args[i]);
    else throw new Error('Geçersiz veya yinelenen komut seçeneği.');
  }
  const file = values.get('--manifest') || fileURLToPath(new URL('../data/printed-catalog/tr-2026-11-06.json', import.meta.url));
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  let report = { ...validatePrintedCatalog(manifest), mode: 'validate', databaseAccessed: false };
  if (switches.has('--apply') || switches.has('--check-db')) {
    const uri = process.env.PRINTED_CATALOG_MONGO_URI;
    const database = values.get('--database');
    if (!uri || !database || !/^[\w-]+$/u.test(database)) throw new Error('Açık PRINTED_CATALOG_MONGO_URI ve --database gerekli; .env otomatik okunmaz.');
    // Remote access is always explicit. Never print connection strings.
    const authority = uri.match(/^mongodb(?:\+srv)?:\/\/([^/?]+)/u)?.[1]?.split('@').at(-1);
    if (!authority) throw new Error('Geçersiz MongoDB bağlantısı.');
    const local = authority.split(',').every(host => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(host));
    if (!local && !switches.has('--allow-remote')) throw new Error('Uzak veritabanı için açık --allow-remote gerekli.');
    if (switches.has('--apply') && (!mongoose.isObjectIdOrHexString(values.get('--admin-id')) || values.get('--expected-sha256') !== report.sha256)) throw new Error('Uygulamak için aktif --admin-id ve incelenen paketin --expected-sha256 değeri gerekli.');
    await mongoose.connect(uri, { dbName: database, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const { importPrintedCatalog } = await import('../services/printedCatalogImportService.js');
    if (switches.has('--apply')) {
      await (await import('../utils/adminAccess.js')).requireAdmin({ user: { id: values.get('--admin-id') } });
      // Do not allow application until the existing ISBN uniqueness guard exists.
      const Book = (await import('../models/book.js')).default;
      const indexes = await Book.collection.indexes();
      if (!indexes.some(index => index.unique && index.key?.isbn === 1 && Object.keys(index.key).length === 1 && index.partialFilterExpression?.isbn?.$type === 'string')) throw new Error('Mevcut benzersiz ISBN kısmi indeksi doğrulanamadı; önce kontrollü indeks kurulumu gerekir.');
      await (await import('../models/printedCatalogRecord.js')).default.createIndexes();
    }
    report = { ...await importPrintedCatalog(manifest, { apply: switches.has('--apply'), adminId: values.get('--admin-id'), expectedSha256: values.get('--expected-sha256') }), databaseAccessed: true, database };
  }
  const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const output = resolve(values.get('--report') || resolve(serverDir, `printed-catalog-report-${Date.now()}.json`));
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  const { entries, ...summary } = report;
  console.log(JSON.stringify({ ...summary, report: output }, null, 2));
} catch (error) {
  const databaseError = error.name?.startsWith('Mongo') || error.name?.startsWith('Mongoose');
  console.error(databaseError ? 'Veritabanı işlemi tamamlanamadı. Bağlantı ve sunucu günlüklerini güvenli ortamda kontrol edin.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
