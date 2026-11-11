import mongoose from 'mongoose';

const connectDB = async () => {
  const connection = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  console.log('MongoDB bağlantısı başarılı.');
  return connection;
};

export default connectDB;
