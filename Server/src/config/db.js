import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB bağlantısı başarılı.');
  } catch (error) {
    console.error('MongoDB bağlantısı başarısız. Ağ ve secret yapılandırmasını kontrol edin.');
    process.exit(1); // Hata varsa uygulamayı durdur
  }
};

export default connectDB;
