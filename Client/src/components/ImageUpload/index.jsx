import React, { useState } from 'react';
import { AddPhotoAlternate } from '@mui/icons-material';

const CLOUD_NAME    = 'dw1sepw7z';
const UPLOAD_PRESET = 'quill_preset';

const cropTo2x3 = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;

      // 2:3 oranı için hedef boyutları hesapla
      let srcX, srcY, srcW, srcH;

      if (w / h > 2 / 3) {
        // Resim çok geniş → yüksekliği baz al, genişliği kırp
        srcH = h;
        srcW = Math.round(h * 2 / 3);
        srcX = Math.round((w - srcW) / 2); // ortadan kırp
        srcY = 0;
      } else {
        // Resim çok uzun → genişliği baz al, yüksekliği kırp
        srcW = w;
        srcH = Math.round(w * 3 / 2);
        srcX = 0;
        srcY = Math.round((h - srcH) / 2); // ortadan kırp
      }

      // Canvas'a çiz
      const canvas = document.createElement('canvas');
      canvas.width  = srcW;
      canvas.height = srcH;
      canvas.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas boş.'));
        resolve(blob);
      }, 'image/jpeg', 0.92);
    };

    img.onerror = reject;
    img.src = url;
  });
};

const ImageUpload = ({ onUploadSuccess, label = 'Resim Yükle', currentImage }) => {
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState(currentImage || '');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      // 2:3 oranında kırp
      const croppedBlob = await cropTo2x3(file);

      // Önizleme
      setPreview(URL.createObjectURL(croppedBlob));

      // Cloudinary'ye yükle
      const formData = new FormData();
      formData.append('file', croppedBlob, 'cover.jpg');
      formData.append('upload_preset', UPLOAD_PRESET);

      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();

      if (data.secure_url) {
        onUploadSuccess(data.secure_url);
      } else {
        throw new Error('Yükleme başarısız');
      }
    } catch (err) {
      console.error('Resim yükleme hatası:', err);
      alert('Resim yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="image-upload-container" style={{ width: '100%', height: '100%' }}>
      <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
        <div style={{
          width: '100%', height: '100%',
          border: '2px dashed #ccc', borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
          backgroundColor: '#f9f9f9', boxSizing: 'border-box',
        }}>
          {loading ? (
            <span style={{ color: '#666' }}>Yükleniyor...</span>
          ) : preview ? (
            <img src={preview} alt="Kapak"
                 style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column',
                          alignItems: 'center', color: '#888' }}>
              <AddPhotoAlternate style={{ fontSize: 48, color: '#9CA3AF' }} />
              <span style={{ fontSize: '14px', marginTop: '10px',
                             fontWeight: '500' }}>{label}</span>
            </div>
          )}
        </div>
      </label>
      <input id="file-upload" type="file" accept="image/*"
             onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  );
};

export default ImageUpload;