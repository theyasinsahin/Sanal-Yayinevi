export const getOptimizedImage = (url, width, height) => {
  if (!url) return "";
  if (!url.includes("cloudinary")) return url; // Cloudinary değilse elleme

  // '/upload/' kısmından sonra dönüşüm parametrelerini ekle
  // c_fill: Resmi kırparak doldurur (yamulmayı önler)
  // q_auto: Kaliteyi optimize eder
  // f_auto: Webp gibi modern formatlara çevirir
  const params = `c_fill,w_${width},h_${height},q_auto,f_auto`;
  
  return url.replace("/upload/", `/upload/${params}/`);
};