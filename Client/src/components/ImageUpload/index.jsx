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
    formData.append("upload_preset", "quill_preset"); 
    const cloudName = "dw1sepw7z"; 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      
      if (data.secure_url) {
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
    // Dış container'ın marginini kaldırdık ve boyutunu %100 yaptık
    <div className="image-upload-container" style={{ width: '100%', height: '100%' }}>
      <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
        <div style={{
          width: '100%',   // DEĞİŞİKLİK: 150px yerine %100
          height: '100%',  // DEĞİŞİKLİK: 200px yerine %100
          // Border ve background'u CreateBook.css'teki wrapper hallettiği için buradan kaldırabilirsin
          // veya şeffaf yapabilirsin. Ama tek başına kullanım için kalsın dersen sorun olmaz.
          border: '2px dashed #ccc', 
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#f9f9f9',
          boxSizing: 'border-box' // Padding taşmalarını önler
        }}>
          {loading ? (
            <span style={{ color: '#666' }}>Yükleniyor...</span>
          ) : preview ? (
            <img 
                src={preview} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#888' }}>
              <AddPhotoAlternate style={{ fontSize: 48, color: '#9CA3AF' }} />
              <span style={{ fontSize: '14px', marginTop: '10px', fontWeight: '500' }}>{label}</span>
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