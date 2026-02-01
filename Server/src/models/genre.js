import mongoose from 'mongoose';

const GenreSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  }, // Örn: "Bilim Kurgu"
  
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  }, // Örn: "bilim-kurgu" (URL dostu)
  
  description: { 
    type: String, 
    default: '' 
  }, // Kategori açıklaması
  
  iconUrl: { 
    type: String, 
    default: '' 
  }, // Kategoriye özel ikon (Cloudinary url)
  
  hexColor: { 
    type: String, 
    default: 'var(--primary)' 
  }, // UI'da kullanılacak tema rengi (Badge rengi vb.)
  
  isActive: {
    type: Boolean,
    default: true
  } // Kategoriyi geçici olarak kapatmak istersen

}, { timestamps: true });

export default mongoose.model('Genre', GenreSchema);