// src/scripts/migratePoints.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import UserScore from '../models/userScore.js';
import PointEvent from '../models/pointEvent.js';

dotenv.config();

const migrate = async () => {
  await connectDB();

  const scores = await UserScore.find({ totalPoints: { $gt: 0 } });
  console.log(`${scores.length} kullanıcı bulundu.`);

  for (const score of scores) {
    // Bu kullanıcı için zaten migration yapıldı mı?
    const existing = await PointEvent.findOne({ 
      userId: score.userId,
      action: 'migration'
    });
    if (existing) {
      console.log(`${score.userId} zaten migrate edilmiş, atlanıyor.`);
      continue;
    }

    // Toplam puanı tek bir migration event olarak ekle
    await PointEvent.create({
      userId: score.userId,
      points: score.totalPoints,
      action: 'migration',
      // Çok eski bir tarih ver ki periyodik filtreleri etkilemesin
      createdAt: new Date('2020-01-01'),
    });

    console.log(`${score.userId} → ${score.totalPoints} puan migrate edildi.`);
  }

  console.log('✅ Migration tamamlandı.');
  mongoose.connection.close();
};

migrate();