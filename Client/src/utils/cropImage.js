// src/utils/cropImage.js
export const getCroppedImg = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');

      // Kırpma alanı resim sınırlarına göre normalize et
      const srcX = Math.max(0, pixelCrop.x);
      const srcY = Math.max(0, pixelCrop.y);
      const srcW = Math.min(pixelCrop.width,  image.width  - srcX);
      const srcH = Math.min(pixelCrop.height, image.height - srcY);

      // Canvas'ta hedef ofseti (negatif x/y durumunda ortalı başla)
      const dstX = Math.max(0, -pixelCrop.x);
      const dstY = Math.max(0, -pixelCrop.y);

      ctx.drawImage(
        image,
        srcX, srcY, srcW, srcH,
        dstX, dstY, srcW, srcH
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas boş.'));
        resolve(blob);
      }, 'image/jpeg', 0.92);
    };
    image.onerror = reject;
  });
};