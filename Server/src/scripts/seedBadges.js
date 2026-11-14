// src/scripts/seedBadges.js
import mongoose from 'mongoose';
import '../config/environment.js';
import connectDB from '../config/db.js';
import { seedBadges } from '../services/developmentReferenceData.js';

const seed = async () => {
  await connectDB();
  await seedBadges();
  console.log('Eksik rozet tanımları eklendi; mevcut tanımlar korundu.');
};

seed().catch(() => {
  console.error('Rozet tanımları hazırlanamadı. Veritabanı bağlantısını kontrol edin.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
