import jwt from 'jsonwebtoken';
import '../config/environment.js';


export const authenticateUser = async (req, User) => {
  // 1. Token var mı kontrol et
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return null; // Token yoksa misafir kullanıcıdır, hata verme null dön.
  }

  try {
    // 2. Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Kullanıcı veritabanında hala var mı?
    const user = await User.findOne({ _id: decoded.userId, isDeleted: false, isActive: { $ne: false } }).select('-password');
    if (user && (decoded.version ?? 0) !== (user.authVersion ?? 0)) return null;
    return user; // Kullanıcıyı dön

  } catch (error) {
    // --- KRİTİK NOKTA BURASI ---
    // Eğer token süresi dolmuşsa (TokenExpiredError) veya geçersizse
    // sunucuyu patlatmak (throw error) yerine sessizce hatayı yut ve null dön.
    // Böylece sunucu "Bu kişi giriş yapmamış" der ve public sayfaları göstermeye devam eder.
    
    // console.log("Auth Hatası (Önemli değil):", error.message); 
    return null; 
  }
};