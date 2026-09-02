// scripts/backfillIsDeleted.js
//
// BİR KERELİK MİGRASYON — soft-delete alanları (isDeleted/deletedAt)
// modellere eklenmeden ÖNCE oluşturulmuş dökümanlarda bu alan hiç
// yok. MongoDB'de { isDeleted: false } sorgusu, alanı hiç olmayan
// dökümanları eşleştirmediği için bu kayıtlar sorgularda "görünmez"
// kalıyor (ne aktif ne silinmiş sayılıyorlar) — bu da örn. Google
// login'de "E11000 duplicate key" gibi hatalara yol açıyor.
//
// Bu script, isDeleted alanı EKSİK olan tüm dökümanlara
// isDeleted:false, deletedAt:null yazar. Zaten isDeleted alanı olan
// dökümanlara DOKUNMAZ (mevcut silinmiş kayıtları etkilemez).
//
// ÇALIŞTIRMA:
//   node src/scripts/backfillIsDeleted.js
//
// (package.json'da "type": "module" varsayıyorum — projenin geri
// kalanı ES modules kullanıyor. Değilse import'ları require'a çevir.)

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

// Soft-delete alanı eklenen tüm koleksiyonlar (mongoose'un varsayılan
// çoğul-küçük-harf koleksiyon adlarıyla)
const COLLECTIONS = [
  'users',
  'books',
  'chapters',
  'comments',
  'messages',
  'sessions',
  'sessionentries',
  'quotes',
];

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('MONGO_URI (veya DATABASE_URL) .env içinde bulunamadı.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ MongoDB bağlantısı kuruldu.');

  const db = mongoose.connection.db;

  for (const collectionName of COLLECTIONS) {
    try {
      const collection = db.collection(collectionName);

      const result = await collection.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false, deletedAt: null } }
      );

      console.log(
        `${collectionName}: ${result.modifiedCount} döküman güncellendi ` +
        `(${result.matchedCount} eşleşti).`
      );
    } catch (err) {
      console.error(`${collectionName} güncellenirken hata:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('✅ Migration tamamlandı, bağlantı kapatıldı.');
};

run().catch((err) => {
  console.error('Migration başarısız:', err);
  process.exit(1);
});