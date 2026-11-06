import { readFileSync } from 'node:fs';
import { validateEditorialManifest } from '../src/utils/printedEditorial.js';
import { classificationSeed } from '../src/data/classification.js';
const manifest=JSON.parse(readFileSync(new URL('../src/data/printed-catalog/tr-editorial-2026-11-06.json',import.meta.url),'utf8'));
test('all 261 books have a reviewed classification, original description, and source trail',()=>{
  expect(validateEditorialManifest(manifest).books).toBe(261);
  expect(manifest.books.every(e=>e.changes.description.includes('\n\n'))).toBe(true);
  expect(new Set(manifest.books.map(e=>e.changes.description)).size).toBe(261);
  expect(manifest.books.map(e=>e.research.recognition.rank)).toEqual(Array.from({length:261},(_,i)=>i+1));
});
test('the warning registry is unchanged and uncertainty is recorded even for empty warnings',()=>{
  expect(classificationSeed.WARNING.map(([slug])=>slug)).toEqual(['siddet','korkutucu-icerik','cinsel-icerik','kendine-zarar','bagimlilik','ayrimcilik','agir-dil']);
  expect(manifest.books.every(e=>e.research.warningAssessment.limitation.includes('Tam metinlerin tamamı okunmadı'))).toBe(true);
  const chess=manifest.books.find(e=>e.identity.title==='Satranç');
  expect(chess.changes.classification.warnings).not.toContain('kendine-zarar');
});
test('editions and less obvious formats are kept distinct',()=>{
  const find=title=>manifest.books.find(e=>e.identity.title.startsWith(title)).changes.classification;
  expect(find('Benoni ile Rosa').format).toBe('tiyatro');
  expect(find('Nasreddin Hoca Fıkraları').audience).toBe('yetiskin');
  expect(find('Potter Cep Kitapları').format).toBe('rehber');
  expect(find('Sherlock Holmes İle Çöz').audience).toBe('cocuk');
  expect(find('Yoldan').format).toBe('fotograf-kitabi');
  expect(manifest.books.filter(e=>e.changes.title)).toHaveLength(1);
  for(const e of manifest.books)expect(Object.keys(e.changes).sort()).toEqual(e.changes.title?['classification','description','recognitionScore','title']:['classification','description','recognitionScore']);
});
