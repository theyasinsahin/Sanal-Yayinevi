import React, { useState } from 'react';
export const DEFAULT_SESSION_COVER = '/images/sessions/default-cover.jpg';

export default function SessionCover({ src, title, className = '', eager = false }) {
  const [failed, setFailed] = useState('');
  if (!src || src === DEFAULT_SESSION_COVER || src === failed) return null;
  const image = src;
  return <img src={image} alt={`${title} oturumunun kapak fotoğrafı`} className={className}
    loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => { if (image !== DEFAULT_SESSION_COVER) setFailed(image); }} />;
}
