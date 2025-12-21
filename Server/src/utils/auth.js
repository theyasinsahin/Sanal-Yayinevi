import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

export const authenticateUser = async (req, User) => {
  // 1. Header'ı al
  const authHeader = req.headers.authorization || '';
  
  // 2. Token var mı ve 'Bearer ' ile başlıyor mu kontrol et
  // Eğer Postman'den 'Bearer Token' seçtiysen header şöyle gelir: "Bearer eyJhbG..."
  let token;
  if (authHeader.startsWith("Bearer ")) {
      // "Bearer " kısmını (ilk 7 karakteri) atıp sadece token'ı alıyoruz
      token = authHeader.split(' ')[1]; 
  } else {
      // Eğer Bearer yoksa direkt header'ı token kabul et (bazı durumlarda gerekebilir)
      token = authHeader;
  }

  if (!token) {
    throw new Error("Not authenticated: Token not found");
  }
  
  let decoded;
  try {
    // 3. Token'ı doğrula
    // DİKKAT: .env dosyanızda ismin JWT_SECRET olduğundan emin olun. 
    // Önceki mesajlarda SECRET_KEY konuşmuştuk, isim uyuşmazlığı olmasın.
    decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.SECRET_KEY);
    
  } catch (err) {
    console.log("Token Verify Error:", err.message); // Hatayı konsolda görmek için
    throw new Error("Invalid or expired token");
  }

  // 4. Payload kontrolü (Burası da önemli!)
  // Login olurken token'ı oluştururken içine { id: ... } mi koydun yoksa { userId: ... } mi?
  // Genelde mongoDB id'leri için 'id' veya '_id' kullanılır.
  // Eğer login kodunda payload'a 'id' dediysen, burada decoded.userId UNDEFINED gelir.
  // Güvenlik için ikisini de kontrol edelim:
  const userId = decoded.userId || decoded.id || decoded._id;

  if (!userId) {
    throw new Error("Invalid token payload: ID not found in token");
  }

  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};