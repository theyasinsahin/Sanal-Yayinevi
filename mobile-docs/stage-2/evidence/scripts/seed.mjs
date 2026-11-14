// Same steps as Server/src/scripts/seedDevelopment.js main(), minus the Docker-hostname assertion,
// plus an explicit check that the target is the sandbox database.
import path from 'node:path';
import { mkdir, writeFile, access } from 'node:fs/promises';
const S = path.resolve(import.meta.dirname, '../app/Server/src');
const uri = new URL(process.env.MONGO_URI);
if (uri.hostname !== '127.0.0.1' || uri.port !== '27055' || uri.pathname !== '/betik_stage2') throw new Error('Refusing: not the sandbox database');
const mongoose = (await import(path.join(S, '../node_modules/mongoose/index.js'))).default;
const { seedDevelopmentData, developmentIds } = await import(path.join(S, 'scripts/seedDevelopment.js'));
const User = (await import(path.join(S, 'models/user.js'))).default;
await mongoose.connect(process.env.MONGO_URI);
const summary = await seedDevelopmentData(process.env.DEV_SEED_PASSWORD);
const { initializePrintFunding } = await import(path.join(S, 'services/print/common.js'));
const { PrintTariff } = await import(path.join(S, 'models/printFunding.js'));
const { createTariff } = await import(path.join(S, 'services/print/applicationService.js'));
await initializePrintFunding();
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
const { samplePdf } = await import(path.join(S, 'scripts/printSandboxSupport.js'));
const dir = path.resolve(import.meta.dirname, '../data/pdf'); await mkdir(dir, { recursive: true });
for (const name of ['cover', 'layout', 'quote']) { const f = path.join(dir, name + '.pdf'); try { await access(f); } catch { await writeFile(f, samplePdf('Sandbox sample ' + name)); } }
console.log(JSON.stringify({ ...summary, database: mongoose.connection.name, host: mongoose.connection.host + ':' + mongoose.connection.port }));
await mongoose.disconnect();
