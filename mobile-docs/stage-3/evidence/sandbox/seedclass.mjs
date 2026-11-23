// Runs the application's own seedClassification() against the sandbox DB only.
import path from 'node:path';
const uri = new URL(process.env.MONGO_URI); if (uri.port !== '27055' || uri.pathname !== '/betik_stage2') throw new Error('not sandbox');
const S = path.resolve(import.meta.dirname, '../app/Server/src');
const mongoose = (await import(path.join(S, '../node_modules/mongoose/index.js'))).default;
await mongoose.connect(process.env.MONGO_URI);
const { seedClassification, getClassificationOptions } = await import(path.join(S, 'services/classificationService.js'));
await seedClassification(); const o = await getClassificationOptions();
console.log(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length])));
console.log('collections:', (await mongoose.connection.db.listCollections().toArray()).map(c => c.name).sort().join(','));
console.log('badges:', await mongoose.connection.db.collection('badges').countDocuments());
await mongoose.disconnect();
