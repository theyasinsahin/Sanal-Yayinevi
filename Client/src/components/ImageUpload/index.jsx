import React, { useEffect, useId, useRef, useState } from 'react';
import { AddPhotoAlternate } from '@mui/icons-material';

const CLOUD_NAME    = 'dw1sepw7z';
const UPLOAD_PRESET = 'quill_preset';

export const cropImage = (file, aspectRatio = 2 / 3, maxWidth = Infinity) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!(w > 0 && h > 0 && aspectRatio > 0 && Number.isFinite(aspectRatio))) throw new Error('Görsel ölçüleri okunamadı.');

        let srcX, srcY, srcW, srcH;

        if (w / h > aspectRatio) {
          // Resim çok geniş → yüksekliği baz al, genişliği kırp
          srcH = h;
          srcW = Math.round(h * aspectRatio);
          srcX = Math.round((w - srcW) / 2); // ortadan kırp
          srcY = 0;
        } else {
          // Resim çok uzun → genişliği baz al, yüksekliği kırp
          srcW = w;
          srcH = Math.round(w / aspectRatio);
          srcX = 0;
          srcY = Math.round((h - srcH) / 2); // ortadan kırp
        }

        // Canvas'a çiz
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / srcW);
        canvas.width  = Math.round(srcW * scale);
        canvas.height = Math.round(srcH * scale);
        canvas.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas boş.'));
          resolve(blob);
        }, 'image/jpeg', 0.92);
      } catch (error) { URL.revokeObjectURL(url); reject(error); }
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
    img.src = url;
  });
};

const ImageUpload = ({ onUploadSuccess, label = 'Resim Yükle', currentImage, aspectRatio = 2 / 3, maxWidth = Infinity,
  maxFileSize = Infinity, allowedTypes, accept = 'image/*', disabled = false, onLoadingChange, onError }) => {
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState(currentImage || '');
  const inputId = useId();
  const mounted = useRef(true);
  const upload = useRef(null);
  const previewUrl = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onUploadSuccess, onLoadingChange, onError };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; upload.current?.abort(); if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); callbacks.current.onLoadingChange?.(false); };
  }, []);
  useEffect(() => {
    setPreview(currentImage || '');
    if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; }
  }, [currentImage]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || loading || disabled) return;
    if (file.size > maxFileSize || (allowedTypes && !allowedTypes.includes(file.type))) {
      const message = 'JPEG, PNG veya WebP biçiminde, en fazla 8 MB bir görsel seçin.';
      if (onError) onError(message); else alert(message);
      e.target.value = ''; return;
    }

    setLoading(true);
    callbacks.current.onLoadingChange?.(true);
    const controller = new AbortController();
    upload.current = controller;

    try {
      const croppedBlob = await cropImage(file, aspectRatio, maxWidth);
      if (!mounted.current || controller.signal.aborted) return;

      // Önizleme
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(croppedBlob);
      setPreview(previewUrl.current);

      // Cloudinary'ye yükle
      const formData = new FormData();
      formData.append('file', croppedBlob, 'cover.jpg');
      formData.append('upload_preset', UPLOAD_PRESET);

      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData, signal: controller.signal }
      );
      const data = await res.json();

      if (res.ok && data.secure_url) {
        if (mounted.current) callbacks.current.onUploadSuccess(data.secure_url);
      } else {
        throw new Error('Yükleme başarısız');
      }
    } catch (err) {
      if (mounted.current && err.name !== 'AbortError') {
        setPreview(currentImage || '');
        if (callbacks.current.onError) callbacks.current.onError('Görsel yüklenemedi. Lütfen tekrar deneyin.');
        else alert('Resim yüklenirken hata oluştu.');
      }
    } finally {
      if (mounted.current) { setLoading(false); callbacks.current.onLoadingChange?.(false); e.target.value = ''; }
    }
  };

  return (
    <div className="image-upload-container" style={{ width: '100%', height: '100%' }}>
      <label htmlFor={inputId} style={{ cursor: disabled ? 'default' : 'pointer', display: 'block', width: '100%', height: '100%' }}>
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
      <input id={inputId} type="file" accept={accept} disabled={disabled || loading} aria-label={label}
             onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  );
};

export default ImageUpload;
