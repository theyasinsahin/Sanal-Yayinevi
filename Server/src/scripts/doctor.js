import '../config/environment.js';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { validateServerEnvironment, startupFailure } from '../config/startup.js';
import { iyzicoSandboxConfigured } from '../services/print/paymentConfig.js';
import { usesDevelopmentMail } from '../config/dockerDevelopmentMail.js';

// Read-only DB diagnostics: a separate connection has no attached models,
// indexes, seed data or provider calls. A TCP listener briefly probes the port.
const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
// engines.node selects a major series; .node-version pins the local patch.
const supported = process.versions.node.split('.')[0] === manifest.engines.node.split('.')[0];
function fail(code, message) { console.error(`[${code}] ${message}`); process.exitCode = 1; }
if (supported) console.log(`[OK] Node.js ${process.versions.node}`);
else fail('NODE_VERSION', `Node.js ${process.versions.node}; proje ${manifest.engines.node} gerektiriyor. .node-version dosyasındaki sürümü kullanın.`);

try {
  const { port } = validateServerEnvironment();
  console.log('[OK] Zorunlu sunucu ayarları ve origin/port biçimi');
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen({ port, ...(process.env.BETIK_ISOLATED_PRINT_SANDBOX === 'true' ? { host: '127.0.0.1' } : {}) }, () => probe.close(resolve));
  });
  console.log('[OK] Sunucu portu kullanılabilir');
} catch (error) { const failure = startupFailure(error); fail(failure.code, failure.message); }

let connection;
if (process.env.MONGO_URI?.trim()) {
  try {
    connection = mongoose.createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    await connection.asPromise();
    const hello = await connection.db.admin().command({ hello: 1 });
    console.log('[OK] MongoDB bağlantısı');
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      fail('MONGO_REPLICA_SET_REQUIRED', 'MongoDB standalone çalışıyor; bölüm puanları, takip ve basım için replica set gerekli. Basımı kapatmak yeterli değildir.');
    } else console.log('[OK] MongoDB replica set / mongos');
  } catch (error) { const failure = startupFailure(error); fail(failure.code, failure.message); }
  finally { await connection?.close().catch(() => {}); }
}
if (process.env.PRINT_PAYMENTS_MODE === 'IYZICO_SANDBOX' && process.env.PRINT_SYSTEM_ENABLED !== 'false' && !iyzicoSandboxConfigured()) console.warn('[UYARI] Iyzico sandbox ayarları eksik; ödeme alınamaz. .env.print.example dosyasını inceleyin.');
if (usesDevelopmentMail(process.env)) console.log('[OK] Docker yerel e-posta arşivi etkin; gerçek e-posta gönderilmez.');
else if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) console.warn('[UYARI] EMAIL_USER / EMAIL_PASS eksik; doğrulama ve parola sıfırlama e-postaları gönderilemez.');
if (!process.env.GOOGLE_CLIENT_ID) console.warn('[UYARI] GOOGLE_CLIENT_ID eksik; Google ile giriş yapılamaz.');
console.log('Kontrol tamamlandı. Secret değerleri gösterilmedi; veritabanına veri yazılmadı.');
