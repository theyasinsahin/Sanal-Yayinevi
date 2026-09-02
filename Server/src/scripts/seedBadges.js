// src/scripts/seedBadges.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Badge from '../models/badge.js';
import connectDB from '../config/db.js';

dotenv.config();

const badges = [
  { key: 'first_comment',    name: 'İlk Adım',        description: 'İlk yorumunu yaptın!',           icon: '📖', condition: { stat: 'commentsCreated', threshold: 1   } },
  { key: 'comments_15',      name: 'Söz Ustası',       description: '15 yorum yaptın!',               icon: '💬', condition: { stat: 'commentsCreated', threshold: 15  } },
  { key: 'comments_50',      name: 'Tartışmacı',       description: '50 yorum yaptın!',               icon: '🗣️', condition: { stat: 'commentsCreated', threshold: 50  } },
  { key: 'first_quote',      name: 'İlk Alıntı',       description: 'İlk alıntını yaptın!',           icon: '✂️', condition: { stat: 'quotesCreated',   threshold: 1   } },
  { key: 'quotes_10',        name: 'Alıntı Avcısı',    description: '10 alıntı yaptın!',              icon: '📜', condition: { stat: 'quotesCreated',   threshold: 10  } },
  { key: 'reposts_5',        name: 'Paylaşımcı',       description: '5 alıntı repostladın!',          icon: '🔁', condition: { stat: 'repostsCreated',  threshold: 5   } },
  { key: 'reading_100',      name: 'Okur',             description: '100 dakika kitap okudun!',       icon: '⏱️', condition: { stat: 'minutesRead',      threshold: 100 } },
  { key: 'reading_500',      name: 'Kitap Kurdu',      description: '500 dakika kitap okudun!',       icon: '📚', condition: { stat: 'minutesRead',      threshold: 500 } },
  { key: 'first_publish',    name: 'Yazar',            description: 'İlk kitabını yayınladın!',       icon: '✍️', condition: { stat: 'booksPublished',   threshold: 1   } },
  { key: 'chapters_5',       name: 'Üretken Yazar',    description: '5 bölüm ekledin!',              icon: '📖', condition: { stat: 'chaptersAdded',    threshold: 5   } },
];

const seed = async () => {
  await connectDB();
  for (const badge of badges) {
    await Badge.findOneAndUpdate({ key: badge.key }, badge, { upsert: true, new: true });
  }
  console.log('✅ Badge\'ler eklendi');
  mongoose.connection.close();
};

seed();