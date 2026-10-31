import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import Book from '../models/book.js';
import Genre from '../models/genre.js';
import Term from '../models/classificationTerm.js';
import { validateClassification } from '../services/classificationService.js';

dotenv.config();

// ⬇ Buraya kendi ID'lerini gir
const AUTHOR_ID = '69d82a6d3bda37a1934db787';
const FORMAT_CODE = process.env.SEED_FORMAT_CODE;
const GENRE_CODES = (process.env.SEED_GENRE_CODES || '').split(',').filter(Boolean);

async function fetchBooks() {
  const res = await fetch(
    'https://openlibrary.org/search.json?q=roman&lang=tur&limit=20&fields=key,title,author_name,cover_i,number_of_pages_median,first_sentence,subject'
  );
  const json = await res.json();
  return json.docs;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB bağlandı');

  if (!FORMAT_CODE || !GENRE_CODES.length) throw new Error('Set SEED_FORMAT_CODE and SEED_GENRE_CODES explicitly; no classification is guessed.');
  const format = await Term.findOne({ kind: 'FORMAT', slug: FORMAT_CODE, isActive: true });
  const genres = await Genre.find({ slug: { $in: GENRE_CODES }, classificationVersion: 1, isActive: true });
  if (!format || genres.length !== GENRE_CODES.length) throw new Error('Unknown classification code.');
  const classification = await validateClassification({ formatId: String(format._id), genreIds: genres.map(item => String(item._id)) }, AUTHOR_ID);
  const books = await fetchBooks();

  const docs = books
    .filter(b => b.cover_i) // Kapak resmi olmayanları atla
    .map(b => ({
      title: b.title,
      authorId: new mongoose.Types.ObjectId(AUTHOR_ID),
      imageUrl: `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`,
      pageCount: b.number_of_pages_median || 200,
      ...classification,
      description: b.first_sentence?.value || b.title,
      status: 'PUBLISHED',
    }));

  await Book.insertMany(docs);
  console.log(`${docs.length} kitap eklendi`);

  await mongoose.disconnect();
}

seed().catch(console.error);