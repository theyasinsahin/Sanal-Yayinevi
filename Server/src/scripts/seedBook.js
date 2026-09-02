import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import Book from '../models/Book.js';

dotenv.config();

// ⬇ Buraya kendi ID'lerini gir
const AUTHOR_ID = '69d82a6d3bda37a1934db787';
const GENRE_ID  = '69d82be53bda37a1934db796';

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

  const books = await fetchBooks();

  const docs = books
    .filter(b => b.cover_i) // Kapak resmi olmayanları atla
    .map(b => ({
      title: b.title,
      authorId: new mongoose.Types.ObjectId(AUTHOR_ID),
      imageUrl: `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`,
      pageCount: b.number_of_pages_median || 200,
      genreId: new mongoose.Types.ObjectId(GENRE_ID),
      tags: (b.subject || []).slice(0, 4),
      description: b.first_sentence?.value || b.title,
      status: 'PUBLISHED',
    }));

  await Book.insertMany(docs);
  console.log(`${docs.length} kitap eklendi`);

  await mongoose.disconnect();
}

seed().catch(console.error);