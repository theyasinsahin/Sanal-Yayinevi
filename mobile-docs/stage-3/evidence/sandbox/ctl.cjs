// Host-side test helper for the on-device verification runs (loopback only).
// Mail sink reader, sandbox DB inspection, rate-bucket reset, device screenshots, adb input,
// and a local stand-in for Cloudinary's unsigned upload API (nothing is forwarded anywhere).
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SB = path.resolve(__dirname, '..');
const mongodbPath = [path.join(SB, 'app/Server/node_modules/mongodb'), path.join(SB, 'app/Server/node_modules/mongoose/node_modules/mongodb')].find(p => fs.existsSync(p));
const { MongoClient, ObjectId } = require(mongodbPath);
const uri = process.env.MONGO_URI; const u = new URL(uri);
if (u.hostname !== '127.0.0.1' || u.port !== '27055') throw new Error('not sandbox');
const client = new MongoClient(uri); const db = client.db('betik_stage2');
const EV = process.env.EV_DIR; const IOS = process.env.IOS_UDID; const ADB = process.env.ADB_SERIAL || 'emulator-5554';
const XENV = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
const revive = (v) => { if (Array.isArray(v)) return v.map(revive); if (v && typeof v === 'object') { if (typeof v.$oid === 'string') return new ObjectId(v.$oid); if (typeof v.$date === 'string') return new Date(v.$date); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])); } return v; };
const mailDir = path.join(SB, 'data/mail');
const handlers = {
  async mail(q) { const files = fs.readdirSync(mailDir).filter(f => f.endsWith('.json')).sort().reverse(); for (const f of files) { const m = JSON.parse(fs.readFileSync(path.join(mailDir, f))); if ((!q.to || (m.to || '').includes(q.to)) && (!q.subject || (m.subject || '').includes(q.subject)) && (!q.text || (m.text || '').includes(q.text))) return { file: f, ...m }; } return null; },
  async mailcount() { return fs.readdirSync(mailDir).length; },
  async find(q) { return db.collection(q.collection).find(revive(q.filter || {}), { projection: q.projection }).sort(q.sort || { _id: -1 }).limit(q.limit || 5).toArray(); },
  async count(q) { return db.collection(q.collection).countDocuments(revive(q.filter || {})); },
  // Used by the suites only to reset fixture state (onboarding flag, preferences); documented in verification_log.md.
  async update(q) { const r = await db.collection(q.collection).updateMany(revive(q.filter), revive(q.update)); return r.modifiedCount; },
  async ratereset() { return (await db.collection('securityratebuckets').deleteMany({})).deletedCount; },
  async shot(q) { const dir = path.join(EV, q.dir || 'screenshots_v'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, q.name + '.png');
    if (q.platform === 'ios') execFileSync('/usr/bin/xcrun', ['simctl', 'io', IOS, 'screenshot', f], { env: XENV, stdio: 'pipe' });
    else fs.writeFileSync(f, execFileSync('adb', ['-s', ADB, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
    return f; },
  async adb(q) { return execFileSync('adb', ['-s', ADB, 'shell', ...q.args], { encoding: 'utf8' }); },
  async uploads() { try { return fs.readFileSync(path.join(SB, 'logs/uploads.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } },
  async pdf(q) { return fs.readFileSync(path.join(SB, 'data/pdf', (q.name || 'cover') + '.pdf')).toString('base64'); },
  async log(q) { fs.appendFileSync(path.join(SB, 'logs/scenarios.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...q }) + '\n'); return true; },
};
let uploads = 0;
http.createServer(async (req, res) => {
  const up = req.url.match(/^\/v1_1\/([^/]+)\/image\/upload$/);
  if (up && req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c); const raw = Buffer.concat(chunks);
    const head = raw.toString('latin1');
    const preset = (head.match(/name="upload_preset"\r\n\r\n([^\r]*)/) || [])[1];
    const start = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    const ok = /^multipart\/form-data/.test(req.headers['content-type'] || '') && preset === 'betik-sandbox-preset' && start > 0 && /name="file"/.test(head);
    fs.appendFileSync(path.join(SB, 'logs/uploads.jsonl'), JSON.stringify({ at: new Date().toISOString(), cloud: up[1], preset, bytes: raw.length, jpeg: start > 0, ok }) + '\n');
    if (!ok) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'bad upload' } })); }
    const n = ++uploads + '_' + Date.now(); fs.mkdirSync(path.join(SB, 'data/uploads'), { recursive: true });
    const end = raw.lastIndexOf(Buffer.from('\r\n--')); fs.writeFileSync(path.join(SB, 'data/uploads', n + '.jpg'), raw.subarray(start, end));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ secure_url: `https://res.cloudinary.com/betik-sandbox-mock/image/upload/v1/sandbox/img_${n}.jpg`, public_id: 'sandbox/img_' + n }));
  }
  let body = ''; for await (const c of req) body += c;
  const name = req.url.replace(/^\//, '').split('?')[0];
  try { const out = await handlers[name](body ? JSON.parse(body) : {}); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: out })); }
  catch (e) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e.message || e) })); }
}).listen(5066, '127.0.0.1', () => console.log('CTL_READY'));
