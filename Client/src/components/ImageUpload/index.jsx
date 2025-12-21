import React, { useState } from 'react';
import { AddPhotoAlternate } from '@mui/icons-material';

const ImageUpload = ({ onUploadSuccess, label = "Resim Yükle", currentImage }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(currentImage || "");

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Önizleme göster
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    // Cloudinary Yükleme İşlemi
    const formData = new FormData();
    formData.append("file", file);
    // BURAYA KENDİ PRESET ADINI YAZ:
    formData.append("upload_preset", "quill_preset"); 
    // BURAYA KENDİ CLOUD NAME'İNİ YAZ:
    const cloudName = "dw1sepw7z"; 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      
      if (data.secure_url) {
        // Yükleme başarılı, URL'i üst bileşene gönder
        onUploadSuccess(data.secure_url);
        setLoading(false);
      } else {
        throw new Error("Yükleme başarısız");
      }
    } catch (error) {
      console.error("Resim yükleme hatası:", error);
      alert("Resim yüklenirken hata oluştu.");
      setLoading(false);
    }
  };

  return (
    <div className="image-upload-container" style={{ textAlign: 'center', margin: '20px 0' }}>
      <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'inline-block' }}>
        <div style={{
          width: '150px',
          height: '200px', // Kitap kapağı oranı (Profil için 150x150 yapabilirsin)
          border: '2px dashed #ccc',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#f9f9f9'
        }}>
          {loading ? (
            <span>Yükleniyor...</span>
          ) : preview ? (
            <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#888' }}>
              <AddPhotoAlternate style={{ fontSize: 40 }} />
              <span style={{ fontSize: '12px', marginTop: '5px' }}>{label}</span>
            </div>
          )}
        </div>
      </label>
      <input 
        id="file-upload" 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

export default ImageUpload;