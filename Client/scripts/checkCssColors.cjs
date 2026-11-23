// Tasarım tokenları koruması: bileşen CSS'lerinde sabit renk (hex/rgb/hsl)
// sayısının artmasını engeller. Renkler src/index.css'teki tokenlardan gelmeli.
//
//   node scripts/checkCssColors.cjs           → kontrol (artış varsa çıkış kodu 1)
//   node scripts/checkCssColors.cjs --update  → mevcut sayıları taban olarak kaydet
//
// Taban dosyası her yeniden tasarım aşamasında küçülür; hedef her dosyada 0.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../src');
const baselineFile = path.join(__dirname, 'css-color-baseline.json');
const TOKEN_FILE = 'index.css';
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return entry.name.endsWith('.css') ? [full] : [];
});

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

const counts = {};
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (rel === TOKEN_FILE) continue;
  const found = stripComments(fs.readFileSync(file, 'utf8')).match(COLOR);
  if (found) counts[rel] = found.length;
}

const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(baselineFile, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Taban güncellendi: ${Object.keys(sorted).length} dosyada ${total} sabit renk.`);
  process.exit(0);
}

const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : {};
const regressions = Object.entries(counts)
  .filter(([file, n]) => n > (baseline[file] || 0))
  .map(([file, n]) => `  ${file}: ${n} (taban ${baseline[file] || 0})`);

console.log(`Sabit renk: ${total} (taban ${Object.values(baseline).reduce((s, n) => s + n, 0)}).`);
if (regressions.length) {
  console.error('Yeni sabit renk eklendi; src/index.css tokenlarını kullanın:');
  console.error(regressions.join('\n'));
  process.exitCode = 1;
}
