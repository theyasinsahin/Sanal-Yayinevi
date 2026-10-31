import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';
import { migrateClassification, rollbackClassification } from '../services/classificationMigration.js';

const args = process.argv.slice(2);
try {
  if (args.some(arg => !['--apply', '--rollback'].includes(arg))) throw new Error('Usage: npm run migrate:classification [-- --apply|--rollback]');
  if (args.includes('--apply') && args.includes('--rollback')) throw new Error('Choose either apply or rollback.');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required.');
  // Even automatic index/collection creation must not write during a dry run.
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  const report = args.includes('--rollback') ? await rollbackClassification() : await migrateClassification({ apply: args.includes('--apply') });
  const path = `classification-report-${Date.now()}.json`;
  await writeFile(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report: ${path}; ${JSON.stringify({ applied: report.applied, skipped: report.skipped, restored: report.restored, conflicts: report.conflicts?.length, books: report.books?.length })}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
