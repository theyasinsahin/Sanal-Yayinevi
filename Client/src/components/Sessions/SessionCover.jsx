import React, { useState } from 'react';
export const DEFAULT_SESSION_COVER = '/images/sessions/default-cover.jpg';

export default function SessionCover({ src, title, className = '', eager = false }) {
  const [failed, setFailed] = useState('');
  const image = src && src !== failed ? src : DEFAULT_SESSION_COVER;
  return <img src={image} alt={`${title} oturumunun kapak fotoğrafı`} className={className}
    loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => { if (image !== DEFAULT_SESSION_COVER) setFailed(image); }} />;
}
