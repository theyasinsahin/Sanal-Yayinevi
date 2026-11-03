import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only pattern scan. Never print matching text or secret values, and never
// load dotenv or connect to a database/provider. This is not a full SAST engine.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).split('\0').filter(Boolean);
const findings = [];
for (const path of paths) {
  if (/\.(?:png|jpe?g|webp|ico|woff2?|ttf|pdf|keystore|zip)$/i.test(path) || /package-lock\.json$/.test(path)) continue;
  let source;
  try { source = readFileSync(resolve(root, path), 'utf8'); } catch { continue; }
  if (source.includes('\0')) continue;
  if (/(?:^|\/)\.env(?:\.(?:prod|production|local))?$/.test(path)) {
    findings.push({ path, line: 1, category: 'TRACKED_SECRET_CONFIGURATION' });
    source.split(/\r?\n/).forEach((line, index) => {
      const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$/.exec(line);
      if (match && /SECRET|PASSWORD|PASS$|PRIVATE_KEY|API_KEY|MONGO_URI|ENCRYPTION_KEY/.test(match[1]) && match[2].length >= 8 && !/^(?:["']?)(?:your[_ -]|change[_ -]|placeholder|example)/i.test(match[2])) findings.push({ path, line: index + 1, category: 'CONFIGURED_SECRET_CANDIDATE', variable: match[1] });
    });
    continue;
  }
  source.split(/\r?\n/).forEach((line, index) => {
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line) || /\bAKIA[0-9A-Z]{16}\b/.test(line) || /GOCSPX-[\w-]{20,}/.test(line)) findings.push({ path, line: index + 1, category: 'SECRET_PATTERN_CANDIDATE' });
  });
}
console.log(JSON.stringify({ scannedWorktreeFiles: paths.length, findings, limitations: 'İzlenen ve henüz eklenmemiş, ignore edilmemiş çalışma dosyaları; sınırlı kalıplar. Değerler basılmaz; geçmiş temizliği veya anahtar geçerlilik denemesi yapılmaz.' }, null, 2));
if (findings.length) process.exitCode = 1;
