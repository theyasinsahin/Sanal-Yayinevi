import '../config/environment.js';
import mongoose from 'mongoose';

// No delete, no monetary conversion, no syncIndexes. Default is read-only.
// Disable implicit schema collection/index creation BEFORE importing any models.
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
try {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI gerekli. Önce ayrı test veritabanını seçin.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const { migratePrintFields } = await import('../services/print/migration.js');
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify(await migratePrintFields({ apply }), null, 2));
  if (apply && process.argv.includes('--indexes')) {
    const { initializePrintFunding } = await import('../services/print/common.js');
    const { default: Notification } = await import('../models/notification.js');
    await initializePrintFunding(); await Notification.createIndexes(); console.log('Eklemeli basım indexleri oluşturuldu; eski indexler silinmedi.');
  }
} catch { console.error('Migration tamamlanamadı. Bağlantı ve replica set yapılandırmasını kontrol edin; gizli bağlantı bilgileri yazdırılmadı.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
