import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let mongod;

// Testler başlamadan önce sanal veritabanına bağlan
export const connect = async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

// Only exposes the ephemeral replica set to subprocess integration tests.
export const getTestDatabaseUri = name => mongod.getUri(name);

// Her testten sonra verileri temizle (Testler birbirini etkilemesin)
export const clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
};

// Tüm testler bitince bağlantıyı kopar
export const closeDatabase = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
};
