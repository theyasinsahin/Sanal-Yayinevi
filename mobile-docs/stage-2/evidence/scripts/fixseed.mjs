// Sandbox-only data repair: the seeded draft book has no description, which makes Book.description (non-null) fail.
import path from 'node:path';
const uri = new URL(process.env.MONGO_URI); if (uri.port !== '27055' || uri.pathname !== '/betik_stage2') throw new Error('not sandbox');
const mongoose = (await import(path.resolve(import.meta.dirname, '../app/Server/node_modules/mongoose/index.js'))).default;
await mongoose.connect(process.env.MONGO_URI);
const r = await mongoose.connection.db.collection('books').updateOne({ _id: new mongoose.Types.ObjectId('000000000000000000000202'), description: { $exists: false } }, { $set: { description: 'Sandbox açıklaması (Stage 2 veri düzeltmesi).' } });
console.log(r.modifiedCount); await mongoose.disconnect();
