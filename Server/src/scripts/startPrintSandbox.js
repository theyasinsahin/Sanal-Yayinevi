import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { sandboxEnvironment, seedSandbox, samplePdf, sandboxGuide } from './printSandboxSupport.js';

const serverDir = fileURLToPath(new URL('../../', import.meta.url));
const root = resolve(serverDir, '..'), clientDir = join(root, 'Client'), output = join(root, '.print-sandbox');
const verify = process.argv.slice(2).includes('--verify');
if (process.argv.slice(2).some(arg => arg !== '--verify')) throw new Error('Yalnız --verify seçeneği desteklenir.');
const children = [];
let mongo, stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  try { if (mongo) await mongo.stop(); } finally { process.exit(code); }
}
process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());

async function portAvailable(port) {
  await new Promise((resolvePort, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`${port} portu kullanılıyor. Mevcut servisi kapatmadan sandbox başlatılmadı.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort));
  });
}
function start(name, entry, cwd, env) {
  const log = openSync(join(output, `${name}.log`), 'w');
  let child;
  try { child = spawn(process.execPath, [entry], { cwd, env, windowsHide: true, stdio: ['ignore', log, log] }); }
  finally { closeSync(log); }
  children.push(child);
  child.once('error', () => { console.error(`${name} başlatılamadı. .print-sandbox/${name}.log dosyasını inceleyin.`); void stop(1); });
  child.once('exit', () => { if (!stopping) { console.error(`${name} durdu. .print-sandbox/${name}.log dosyasını inceleyin.`); void stop(1); } });
}
async function waitFor(url, method = 'GET') {
  const started = Date.now();
  while (Date.now() - started < 600000) {
    try {
      const response = await fetch(url, { method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ healthCheck }' }) } : {}), signal: AbortSignal.timeout(2000) });
      if (response.ok && (method !== 'POST' || (await response.json()).data?.healthCheck)) return;
    } catch { /* Wait for this launcher's local child to become ready. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  throw new Error(`${url} hazır olmadı. .print-sandbox içindeki logları inceleyin.`);
}
async function main() {
  await portAvailable(5125); if (!verify) await portAvailable(3125);
  await mkdir(output, { recursive: true });
  console.log('İzole geçici MongoDB replica set başlatılıyor; üretim yapılandırması kullanılmaz.');
  const dbName = `betik_print_sandbox_${randomBytes(12).toString('hex')}`;
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' }, instanceOpts: [{ ip: '127.0.0.1' }] });
  const uri = mongo.getUri(dbName), env = sandboxEnvironment(uri);
  // Any lazy environment import during seeding must also skip .env/.env.prod.
  process.env.BETIK_ISOLATED_PRINT_SANDBOX = 'true'; process.env.NODE_ENV = 'development'; process.env.MONGO_URI = uri;
  const data = await seedSandbox(uri);
  for (const [filename, title] of [['cover.pdf', 'Sandbox cover'], ['layout.pdf', 'Sandbox layout'], ['quote.pdf', 'Sandbox quote']]) await writeFile(join(output, filename), samplePdf(title));
  await writeFile(join(output, 'README.md'), sandboxGuide(data), { mode: 0o600 });
  console.log('Örnek veriler hazır. Yerel API başlatılıyor.');
  start('server', join(serverDir, 'index.js'), serverDir, env);
  await waitFor('http://127.0.0.1:5125', 'POST');
  if (verify) {
    const { verifySandboxFlow } = await import('./verifyPrintSandboxFlow.js');
    await verifySandboxFlow(data);
    console.log('SANDBOX_HTTP_VERIFIED: giriş, başvuru, onay, ödeme, hedef, basım, teslimat ve tam iade doğrulandı.');
    await stop(); return;
  }
  console.log('Arayüz derleniyor. İlk başlatma birkaç dakika sürebilir.');
  start('client', join(clientDir, 'node_modules/react-scripts/scripts/start.js'), clientDir, {
    ...env, HOST: '127.0.0.1', PORT: '3125', BROWSER: 'none',
    REACT_APP_API_URL: 'http://127.0.0.1:5125', REACT_APP_WS_URL: 'ws://127.0.0.1:5125/graphql',
    REACT_APP_PUBLIC_WEB_URL: 'http://127.0.0.1:3125', REACT_APP_GOOGLE_CLIENT_ID: 'local-sandbox.apps.googleusercontent.com',
  });
  await waitFor('http://127.0.0.1:3125');
  console.log('SANDBOX_READY http://127.0.0.1:3125/login');
  console.log('Hesaplar, test şifresi, PDF dosyaları ve adımlar: .print-sandbox/README.md');
  console.log('Ortamı açık tutun. Ctrl+C yalnız bu sandbox süreçlerini durdurur; geçici test verileri silinir.');
}
main().catch(async error => { console.error(error.message); await stop(1); });
