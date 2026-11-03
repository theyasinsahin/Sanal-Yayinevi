import jwt from 'jsonwebtoken';
import '../config/environment.js';
import mongoose from 'mongoose';

export function verifyAccessToken(token) {
  const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], maxAge: '1d' });
  if (!claims || typeof claims !== 'object' || !mongoose.isObjectIdOrHexString(claims.userId) || claims.version != null && (!Number.isSafeInteger(claims.version) || claims.version < 0)) throw new Error('Geçersiz oturum.');
  return claims;
}


export const authenticateUser = async (req, User) => {
  // 1. Token var mı kontrol et
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return null; // Token yoksa misafir kullanıcıdır, hata verme null dön.
  }

  try {
    // 2. Token'ı doğrula
    const decoded = verifyAccessToken(token);
    
    // 3. Kullanıcı veritabanında hala var mı?
    const user = await User.findOne({ _id: decoded.userId, isDeleted: false, isActive: { $ne: false }, loginBlocked: { $ne: true } }).select('-password -resetPasswordToken -resetPasswordExpires -googleSubject');
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
