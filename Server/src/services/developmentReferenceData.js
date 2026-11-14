import Badge from '../models/badge.js';
import Genre from '../models/genre.js';
import Term from '../models/classificationTerm.js';
import { badgeSeed } from '../data/badges.js';
import { getClassificationOptions, seedClassification } from './classificationService.js';

export async function seedBadges() {
  await Badge.init();
  const now = new Date();
  for (const badge of badgeSeed) {
    await Badge.updateOne({ key: badge.key }, { $setOnInsert: { ...badge, createdAt: now, updatedAt: now } },
      { upsert: true, runValidators: true, timestamps: false });
  }
}

export async function seedDevelopmentReferenceData() {
  await Promise.all([Genre.init(), Term.init()]);
  await seedClassification();
  await seedBadges();
  const options = await getClassificationOptions();
  if (!options.formats.length || !options.genres.length) {
    throw new Error('Yerel sınıflandırma kullanıma hazır değil. En az bir aktif eser biçimi ve tür gerekli; yönetici seçimlerini kontrol edin.');
  }
  return options;
}
