import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import User from '../src/models/user.js';
import AdminAudit from '../src/models/adminAudit.js';
import PrintedCatalogRecord from '../src/models/printedCatalogRecord.js';
import { importPrintedCatalog } from '../src/services/printedCatalogImportService.js';
import { validatePrintedCatalog } from '../src/utils/printedCatalog.js';
import { getPrintedBooks } from '../src/services/printedBookService.js';

const manifestFile = fileURLToPath(new URL('../src/data/printed-catalog/tr-2026-11-06.json', import.meta.url));
const cli = fileURLToPath(new URL('../src/scripts/importPrintedCatalog.js', import.meta.url));
let manifest;
beforeAll(async () => {
  manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  await connect(); await Promise.all([Book.init(), PrintedCatalogRecord.init(), AdminAudit.init()]);
});
afterAll(closeDatabase);
afterEach(clearDatabase);

test('the entire reviewed data package imports and reimports against an isolated replica set', async () => {
  const summary = validatePrintedCatalog(manifest);
  const admin = await User.create({ username: 'data_admin', fullName: 'Catalog Data Admin', email: 'data-admin@example.test', password: 'test', role: 'ADMIN' });
  const preview = await importPrintedCatalog(manifest);
  expect(preview.entries.every(entry => entry.outcome === 'WOULD_CREATE')).toBe(true);
  expect(await Book.countDocuments()).toBe(0);
  const options = { apply: true, adminId: admin.id, expectedSha256: summary.sha256 };
  const first = await importPrintedCatalog(manifest, options);
  expect(first).toMatchObject({ created: summary.books, existing: 0, conflicts: 0 });
  expect(await Book.countDocuments({ kind: 'PRINTED', status: 'PUBLISHED', publicationStatus: 'APPROVED', authorId: null })).toBe(summary.books);
  expect(await PrintedCatalogRecord.countDocuments({ manifestSha256: summary.sha256 })).toBe(summary.books);
  expect(await AdminAudit.countDocuments({ action: 'IMPORT_PRINTED_CATALOG' })).toBe(summary.books);
  expect((await getPrintedBooks({})).total).toBe(summary.books);
  expect((await getPrintedBooks({ search: manifest.books[0].isbn })).total).toBe(1);
  const second = await importPrintedCatalog(manifest, options);
  expect(second).toMatchObject({ created: 0, existing: summary.books, conflicts: 0 });
  expect(await Book.countDocuments()).toBe(summary.books);
}, 180000);

test('the default CLI validates offline even with database environment variables present', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'betik-catalog-test-'));
  try {
    const reportFile = join(temp, 'offline-report.json');
    const result = spawnSync(process.execPath, [cli, '--manifest', manifestFile, '--report', reportFile], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
      env: { ...process.env, MONGO_URI: 'mongodb://private-config.invalid/test', PRINTED_CATALOG_MONGO_URI: 'mongodb://private-config.invalid/test' },
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(await readFile(reportFile, 'utf8'))).toMatchObject({ mode: 'validate', databaseAccessed: false, books: manifest.books.length });
  } finally {
    if (dirname(resolve(temp)) !== resolve(tmpdir()) || !basename(temp).startsWith('betik-catalog-test-')) throw new Error('Unexpected test cleanup path');
    await rm(temp, { recursive: true, force: true });
  }
});

test('remote database checks require an explicit flag and never print credentials', () => {
  const result = spawnSync(process.execPath, [cli, '--manifest', manifestFile, '--check-db', '--database', 'catalog_test'], {
    encoding: 'utf8', timeout: 15000, windowsHide: true,
    env: { ...process.env, PRINTED_CATALOG_MONGO_URI: 'mongodb://private-config.invalid/test' },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('--allow-remote');
  expect(result.stderr + result.stdout).not.toContain('private-config.invalid');
  expect(result.stderr + result.stdout).not.toContain('private-user');
});
