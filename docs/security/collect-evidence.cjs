// Read-only collection of local verification results. No dotenv, network or app
// imports. Only summaries, filenames and variable NAMES may enter the output.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const read = file => {
  const bytes = fs.readFileSync(path.join(root, file));
  return (bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '').replace(/\u001b\[[\d;]*m/g, '');
};
const write = (file, value) => fs.writeFileSync(path.join(__dirname, file), JSON.stringify(value, null, 2) + '\n');
const logs = fs.readdirSync(root).filter(file => /^security-.*\.log$/.test(file));
const runs = logs.flatMap(file => {
  const text = read(file), suites = [...text.matchAll(/^Test Suites:\s*(.+)$/gm)].at(-1)?.[1]?.trim();
  if (!suites) return [];
  return [{ file, suites, tests: [...text.matchAll(/^Tests:\s*(.+)$/gm)].at(-1)?.[1]?.trim() || 'suite could not execute', time: [...text.matchAll(/^Time:\s*(.+)$/gm)].at(-1)?.[1]?.trim(), note: /release-check/.test(file) ? 'Son tam koşu' : 'Başlangıç, regresyon veya ara/odaklı koşu; toplamlar birbirine eklenmez' }];
});
write('TEST_RUNS_REDACTED.json', { date: '2026-11-01', runtime: process.version, runs });

const dependency = { date: '2026-11-01', source: 'npm audit registry.npmjs.org', warning: 'Paket uyarısı uygulama istismarı sayısı değildir.' };
for (const dir of ['server', 'client']) for (const phase of ['before', 'after']) {
  const data = JSON.parse(read(`security-${dir}-audit-${phase}.json`));
  dependency[`${dir}_${phase}`] = { counts: data.metadata?.vulnerabilities, packages: Object.entries(data.vulnerabilities || {}).map(([name, value]) => ({ name, severity: value.severity, direct: value.isDirect, fixAvailable: value.fixAvailable, advisories: value.via.filter(item => typeof item === 'object').map(item => ({ id: item.source, url: item.url, title: item.title })) })) };
}
if (fs.existsSync(path.join(root, 'security-server-audit-prod.json'))) dependency.server_production = JSON.parse(read('security-server-audit-prod.json')).metadata?.vulnerabilities;
write('DEPENDENCY_AUDIT_REDACTED.json', dependency);

const lockfiles = ['Server', 'Client'].map(dir => {
  const lock = JSON.parse(read(`${dir}/package-lock.json`));
  const packages = Object.values(lock.packages).filter(item => item.resolved);
  return { directory: dir, packages: packages.length, origins: [...new Set(packages.map(item => new URL(item.resolved).origin))], missingIntegrity: packages.filter(item => !item.integrity).length };
});
write('LOCKFILE_CHECK.json', lockfiles);

if (fs.existsSync(path.join(root, 'security-client-lint.json'))) {
  const lint = JSON.parse(read('security-client-lint.json'));
  write('FULL_CLIENT_LINT_REDACTED.json', { errors: lint.reduce((sum, item) => sum + item.errorCount, 0), warnings: lint.reduce((sum, item) => sum + item.warningCount, 0), filesWithErrors: lint.filter(item => item.errorCount).map(item => ({ file: path.relative(root, item.filePath).replaceAll('\\', '/'), errors: item.errorCount, rules: [...new Set(item.messages.filter(message => message.severity === 2).map(message => message.ruleId))] })) });
}

const secretCandidates = [];
for (const file of ['Server/.env', 'Client/.env']) {
  if (!fs.existsSync(path.join(root, file))) continue;
  for (const line of read(file).split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || !/SECRET|PASSWORD|PASS$|PRIVATE_KEY|API_KEY|MONGO_URI|ENCRYPTION_KEY/.test(match[1])) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (value.length >= 8) secretCandidates.push({ name: match[1], value });
  }
}
const matches = [], artifactFiles = [];
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(target);
    else if (/\.(?:js|map|html|json|css)$/.test(entry.name)) {
      artifactFiles.push(target);
      const bytes = fs.readFileSync(target);
      for (const secret of secretCandidates) if (bytes.includes(Buffer.from(secret.value))) matches.push({ file: path.relative(root, target).replaceAll('\\', '/'), variable: secret.name });
    }
  }
}
if (fs.existsSync(path.join(root, 'Client/build'))) inspect(path.join(root, 'Client/build'));
write('BUILD_SECRET_SCAN_REDACTED.json', { files: artifactFiles.length, comparedLocalSecretCandidates: secretCandidates.length, matches, limits: 'Yalnız mevcut yerel env secret adaylarıyla tam değer eşleşmesi; genel secret yokluğu veya geçmiş artefakt temizliği kanıtı değildir. Değerler yazılmaz.' });

const locations = [
  ['001', '.gitignore', /^\.env$/], ['001', 'Server/src/scripts/securityScan.js', /TRACKED_SECRET_CONFIGURATION/],
  ['002', 'Server/src/graphql/resolvers/chapter.js', /content: async/], ['002', 'Server/src/security/richText.js', /function cleanRichText/], ['002', 'Client/src/pages/BookReader/index.jsx', /dangerouslySetInnerHTML/],
  ['003', 'Server/src/services/sessionService.js', /function requireSessionRead/], ['003', 'Server/src/services/sessionService.js', /function validSessionCode/], ['003', 'Server/src/graphql/resolvers/session.js', /onNewSessionEntry: \{/],
  ['004', 'Server/src/services/userService.js', /export const resetPassword/], ['004', 'Server/src/services/userService.js', /export const changePassword/], ['004', 'Server/src/graphql/resolvers/user.js', /logout: async/], ['004', 'Server/src/utils/auth.js', /function verifyAccessToken/],
  ['005', 'Server/src/services/userService.js', /export const sendRegistrationCode/], ['005', 'Server/src/services/userService.js', /export const registerUser/], ['005', 'Server/src/models/verification.js', /attempts:/],
  ['006', 'Server/src/routes/googleAuthRoutes.js', /const cookies =/], ['006', 'Server/src/services/userService.js', /authenticateWithGoogleCredential =/], ['006', 'Client/src/utils/googleLoginNonce.js', /function consumeGoogleLoginNonce/],
  ['007', 'Server/src/security/graphqlSecurity.js', /function checkDocument/], ['007', 'Server/src/security/rateLimit.js', /function limitOperation/], ['007', 'Server/src/security/websocketSecurity.js', /function websocketOptions/], ['007', 'Server/src/security/httpSecurity.js', /function websocketAddress/],
  ['008', 'Server/src/services/adminService.js', /record.loginBlocked =/], ['008', 'Server/src/services/userService.js', /user.isDeleted \|\| user.loginBlocked/],
  ['009', 'Server/src/services/quoteService.js', /function readableQuoteBooks/], ['009', 'Server/src/utils/quoteAccess.js', /const book = await Book/], ['009', 'Server/src/graphql/resolvers/quote.js', /const visibleText/],
  ['010', 'Server/src/services/bookService.js', /export const findBookById/], ['010', 'Server/src/utils/bookAccess.js', /function canReadBook/], ['010', 'Server/src/graphql/resolvers/message.js', /attachedBook: async/],
  ['011', 'Server/src/security/search.js', /function literalSearch/], ['012', 'Server/src/utils/formatError.js', /const formatError/], ['012', 'Server/src/graphql/resolvers/user.js', /const accountMessage =/], ['012', 'Server/src/security/httpSecurity.js', /function configureHttpSecurity/],
  ['013', 'Server/src/services/print/assetService.js', /function uploadAsset/], ['013', 'Client/src/components/ImageUpload/index.jsx', /maxFileSize = 8/], ['014', 'Server/package.json', /"@apollo\/server":/], ['014', 'Client/package.json', /"@capacitor\/android":/],
];
let locationText = '# Bulgu kod konumları\n\nSon çalışma ağacındaki kontrol konumlarıdır; önceki açık davranışın yeniden üretimi regresyon/test dosyalarında ve [denetimde](SECURITY_AUDIT_TR.md) açıklanır. SEC-001 için eski `.env` satırları yalnız [redakte taramada](SECRET_SCAN_REDACTED.json) bulunur.\n\n| Bulgu | Son kod konumu |\n| --- | --- |\n';
for (const [id, file, expression] of locations) {
  const line = read(file).split(/\r?\n/).findIndex(value => expression.test(value)) + 1;
  if (!line) throw new Error(`Location missing: ${id} ${file}`);
  locationText += `| BETIK-SEC-${id} | [${file}:${line}](../../${file}#L${line}) |\n`;
}
fs.writeFileSync(path.join(__dirname, 'FINDING_LOCATIONS_TR.md'), locationText);

const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 10000000 }).trim().split(/\r?\n/).filter(Boolean);
const files = [...new Set([...git(['diff', '--name-only']), ...git(['diff', '--cached', '--name-only']), ...git(['ls-files', '--others', '--exclude-standard'])])].sort();
let manifest = '# Değişen dosyalar\n\n1 Kasım 2026. Başlangıç çalışma ağacı temizdi. Commit/push yapılmadı. `Server/.env` satırı yalnız Git indeksinden çıkarılmayı ifade eder; yerel dosya korundu ve değeri raporlanmaz.\n\n';
manifest += 'İş paketi/gerekçe: [uygulama planı](SECURITY_ACTION_PLAN_TR.md). Bulgu/test kanıtı: [denetim](SECURITY_AUDIT_TR.md), [testler](SECURITY_TEST_RESULTS_TR.md).\n\n';
manifest += files.map(file => `- \`${file}\`${file === 'Server/.env' ? ' — sadece Git takibi kaldırıldı' : ''}`).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'CHANGED_FILES_TR.md'), manifest);
console.log(JSON.stringify({ recordedTestRuns: runs.length, changedFiles: files.length, artifactFiles: artifactFiles.length, artifactSecretMatches: matches.length, lockfiles }));
if (matches.length) process.exitCode = 1;
