// Disposable single-node replica set, bound to 127.0.0.1, data inside the sandbox.
const path = require('path');
const SB = path.resolve(__dirname, '..');
const { MongoMemoryReplSet } = require(path.join(SB, 'app/Server/node_modules/mongodb-memory-server'));
(async () => {
  const rs = await MongoMemoryReplSet.create({
    binary: { version: '8.0.34', downloadDir: path.join(SB, 'mongo-bin') },
    replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port: 27055, ip: '127.0.0.1', dbPath: path.join(SB, 'data/mongo') }],
  });
  await rs.waitUntilRunning();
  console.log('MONGO_READY ' + rs.getUri());
  const stop = async () => { await rs.stop({ doCleanup: false }); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
})().catch(e => { console.error(e); process.exit(1); });
