import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import User from '../src/models/user.js';
import Term from '../src/models/classificationTerm.js';
import Genre from '../src/models/genre.js';
import AdminAudit from '../src/models/adminAudit.js';
import Record from '../src/models/printedEditorialRecord.js';
import { seedClassification } from '../src/services/classificationService.js';
import { applyPrintedEditorial } from '../src/services/printedEditorialService.js';
import { editorialDigest, editorialFingerprint, validateEditorialManifest } from '../src/utils/printedEditorial.js';
import { getPrintedBooks } from '../src/services/printedBookService.js';

let admin, member;
beforeAll(async () => { await connect(); await Promise.all([Book.init(), User.init(), Term.init(), Genre.init(), Record.init(), AdminAudit.init()]); });
afterAll(closeDatabase);
beforeEach(async () => {
  await seedClassification();
  [admin, member] = await User.create([
    { username:'editor_admin',fullName:'Editor',email:'editor@example.test',password:'test',role:'ADMIN' },
    { username:'editor_member',fullName:'Reader',email:'reader@example.test',password:'test' },
  ]);
});
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
async function fixture() {
  const book = await Book.create({ kind:'PRINTED',publicationStatus:'APPROVED',status:'PUBLISHED',title:'Satranç',printedAuthor:'Stefan Zweig',isbn:'9786053606116',publisher:'Örnek yayınevi',pageCount:88,publicationYear:2013,description:'Önceki açıklama',imageUrl:'https://publisher.example/cover.jpg',stats:{views:13,likes:5,shares:2} });
  const raw = await Book.findById(book._id).lean();
  const manifest = { schemaVersion:1,batchId:'test-editorial',reviewedAt:new Date().toISOString(),scope:'TR_GENERAL_READERS',methodology:{population:'Türkiye’deki genel okur'},books:[{
    identity:{bookId:book.id,isbn:book.isbn,title:book.title,printedAuthor:book.printedAuthor},beforeSha256:editorialFingerprint(raw),
    changes:{description:'Bir gemi yolculuğunda satranç şampiyonuna karşı oynanan parti, geçmişin baskı ve tecrit deneyimini yeniden canlandırır. Anlatı, insanın zihinsel gücü ve kırılganlığı arasındaki ilişkiyi araştırır.\n\nKısa kurgu, gemideki karşılaşmayı geçmişe açılan bir çerçeve içinde aktarır.',classification:{format:'kisa-kurgu',genres:['psikolojik-kurgu'],tags:['Tecrit','Zihinsel mücadele'],features:['cerceve-anlati'],audience:'genel-okur',warnings:['siddet']},recognitionScore:1000000},
    research:{sources:[{role:'PUBLISHER',url:'https://publisher.example/book'},{role:'BOOKSELLER',url:'https://retailer.example/book'}],warningAssessment:{status:'SUPPORTED_FLAGS',basis:'Tecrit ve psikolojik işkence anlatısı.',limitation:'Mevcut kaynaklarla sınırlı bir incelemedir; tüm metin okunmuş veya her yaşa uygunluk onaylanmış sayılmaz.'},recognition:{rank:1,confidence:'MEDIUM',limitation:'Arama dizini görünürlüğü bir nüfus araştırması değildir; baskı sayaçları toplanmamıştır.'}},
  }]};
  return { book, raw, manifest };
}
const apply = manifest => applyPrintedEditorial(manifest,{apply:true,adminId:admin.id,expectedSha256:editorialDigest(manifest)});
test('dry run reads the catalog without editing books, terms, provenance, or logs', async () => {
  const { book,raw,manifest } = await fixture();
  const terms = await Term.countDocuments();
  expect(await applyPrintedEditorial(manifest)).toMatchObject({updated:0,mode:'dry-run',conflicts:[],newTerms:2});
  expect(await Book.findById(book._id).lean()).toEqual(raw);
  expect(await Term.countDocuments()).toBe(terms);
  expect(await Record.countDocuments()).toBe(0);
  expect(await AdminAudit.countDocuments()).toBe(0);
});
test('apply requires the reviewed hash and a currently active administrator', async () => {
  const {manifest}=await fixture();
  await expect(applyPrintedEditorial(manifest,{apply:true,adminId:admin.id,expectedSha256:'wrong'})).rejects.toThrow('SHA-256');
  await expect(applyPrintedEditorial(manifest,{apply:true,adminId:member.id,expectedSha256:editorialDigest(manifest)})).rejects.toThrow('yönetici');
  await User.updateOne({_id:admin._id},{isActive:false});
  await expect(apply(manifest)).rejects.toThrow('yönetici');
});
test('curation updates only reviewed fields and records a reversible before/after image', async () => {
  const {book,raw,manifest}=await fixture();
  const digital=await Book.create({title:'Dijital eser',authorId:member._id,status:'PUBLISHED',description:'Dokunulmayacak açıklama'});
  const digitalBefore=await Book.findById(digital._id).lean();
  expect(await apply(manifest)).toMatchObject({updated:1,conflicts:[]});
  const after=await Book.findById(book._id).lean();
  expect(after).toMatchObject({description:manifest.books[0].changes.description,classificationStatus:'COMPLETE',recognitionScore:1000000,editorialVersion:'test-editorial',isbn:raw.isbn,printedAuthor:raw.printedAuthor,publisher:raw.publisher,imageUrl:raw.imageUrl,publicationYear:raw.publicationYear,pageCount:raw.pageCount,createdAt:raw.createdAt,stats:raw.stats,chapters:[]});
  expect(after.authorId).toBeUndefined();
  expect(after.formatId).toBeDefined();expect(after.tagIds).toHaveLength(2);
  expect(await Book.findById(digital._id).lean()).toEqual(digitalBefore);
  expect((await User.findById(member._id)).usersBooks).toHaveLength(0);
  const record=await Record.findOne({bookId:book._id}).lean();
  expect(record.before.description).toBe(raw.description);
  expect(record.afterSha256).toBe(editorialFingerprint(after));
  expect(record.research).toEqual(manifest.books[0].research);
  expect(await AdminAudit.countDocuments({action:'CURATE_PRINTED_CATALOG'})).toBe(1);
});
test('a stale review or a newly published unreviewed book prevents the entire batch', async () => {
  const {book,manifest}=await fixture();
  await Book.updateOne({_id:book._id},{description:'Yönetici tarafından değiştirildi'});
  expect(await apply(manifest)).toMatchObject({updated:0,conflicts:[{reason:'STALE_REVIEW'}]});
  expect(await Record.countDocuments()).toBe(0);
  expect(await Term.countDocuments({kind:'TAG'})).toBe(0);
  const other=await Book.create({kind:'PRINTED',publicationStatus:'APPROVED',status:'PUBLISHED',title:'Yeni eser'});
  expect((await applyPrintedEditorial(manifest)).conflicts).toEqual(expect.arrayContaining([expect.objectContaining({bookId:other.id,reason:'UNREVIEWED_PUBLISHED_BOOK'})]));
});
test('a failed audit write rolls back books, newly created tags, and provenance', async () => {
  const {book,raw,manifest}=await fixture();
  jest.spyOn(AdminAudit,'insertMany').mockRejectedValueOnce(new Error('audit unavailable'));
  await expect(apply(manifest)).rejects.toThrow('audit unavailable');
  expect(await Book.findById(book._id).lean()).toEqual(raw);
  expect(await Record.countDocuments()).toBe(0);
  expect(await Term.countDocuments({kind:'TAG'})).toBe(0);
});
test('reapplying the same batch is idempotent and preserves later human edits', async () => {
  const {book,manifest}=await fixture();
  await apply(manifest);
  const after=await Book.findById(book._id).lean();
  expect(await apply(manifest)).toMatchObject({updated:0,existing:1,conflicts:[]});
  expect(await Book.findById(book._id).lean()).toEqual(after);
  expect(await Record.countDocuments()).toBe(1);
  expect(await Term.countDocuments({kind:'TAG'})).toBe(2);
  await Book.updateOne({_id:book._id},{description:'Daha sonraki insan düzenlemesi'});
  expect((await apply(manifest)).conflicts).toEqual([expect.objectContaining({reason:'APPLIED_RECORD_CHANGED'})]);
  expect((await Book.findById(book._id)).description).toBe('Daha sonraki insan düzenlemesi');
});
test('inactive existing taxonomy is never reactivated by the batch', async () => {
  const {manifest}=await fixture();
  await Genre.updateOne({slug:'psikolojik-kurgu'},{isActive:false});
  expect((await apply(manifest)).conflicts).toEqual([expect.objectContaining({reason:'GENRE_UNAVAILABLE'})]);
  expect((await Genre.findOne({slug:'psikolojik-kurgu'})).isActive).toBe(false);
  expect(await Record.countDocuments()).toBe(0);
});
test('missing classification references after apply require review instead of reporting success', async () => {
  const {manifest}=await fixture();
  await apply(manifest);
  await Term.deleteOne({kind:'TAG',normalizedName:'tecrit'});
  const result=await apply(manifest);
  expect(result.updated).toBe(0);
  expect(result.conflicts).toEqual([expect.objectContaining({reason:'APPLIED_TERM_MISSING'})]);
  expect(await Term.countDocuments({kind:'TAG',normalizedName:'tecrit'})).toBe(0);
});
test('unreviewed fields, invented warnings, duplicates, and unaudited title changes are rejected', async () => {
  const {manifest}=await fixture();
  const mutations=[m=>m.books[0].changes.stats={views:999},m=>m.books[0].changes.authorId=admin.id,m=>m.books[0].changes.classification.warnings=['istismar'],m=>m.books[0].changes.classification.warnings=['olum-yas'],m=>m.books.push(structuredClone(m.books[0])),m=>m.books[0].changes.title='Başka eser',m=>m.books[0].changes.classification.tags=['Aşk','aşk'],m=>m.books[0].research.recognition.rank=2];
  for(const mutate of mutations){const m=structuredClone(manifest);mutate(m);expect(()=>validateEditorialManifest(m)).toThrow();}
});
test('printed sorting keeps recognized older books first across pagination and search', async () => {
  const documents=Array.from({length:15},(_,i)=>({kind:'PRINTED',publicationStatus:'APPROVED',status:'PUBLISHED',title:`Kitap ${i}`,recognitionScore:100-i,createdAt:new Date(2000+i,0,1)}));
  await Book.insertMany(documents);
  await Book.create({kind:'PRINTED',publicationStatus:'APPROVED',status:'PUBLISHED',title:'Yeni incelemesiz eser'});
  await Book.create({title:'Dijital eser',status:'PUBLISHED',recognitionScore:1000000});
  const first=await getPrintedBooks({page:1}),second=await getPrintedBooks({page:2});
  expect(first.books.map(b=>b.title)).toEqual(Array.from({length:12},(_,i)=>`Kitap ${i}`));
  expect(second.books.map(b=>b.title)).toEqual(['Kitap 12','Kitap 13','Kitap 14','Yeni incelemesiz eser']);
  expect(first.total).toBe(16);
  expect((await getPrintedBooks({search:'Kitap 1'})).books.map(b=>b.title)).toEqual(['Kitap 1','Kitap 10','Kitap 11','Kitap 12','Kitap 13','Kitap 14']);
});
