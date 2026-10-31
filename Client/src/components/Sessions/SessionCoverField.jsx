import React, { useState } from 'react';
import ImageUpload from '../ImageUpload';
import { Button } from '../UI/Button';
import { DEFAULT_SESSION_COVER } from './SessionCover';
import './SessionCover.css';
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function SessionCoverField({ value, onChange, onLoadingChange, disabled }) {
  const [error, setError] = useState('');
  return <div className="session-cover-field">
    <span className="sessions-label">Kapak fotoğrafı (isteğe bağlı)</span>
    <div className={`session-cover-upload${!value || value === DEFAULT_SESSION_COVER ? ' session-cover-upload--empty' : ''}`}>
      <ImageUpload currentImage={value === DEFAULT_SESSION_COVER ? '' : value} label="Oturum kapağı yükle" aspectRatio={16 / 9} maxWidth={1600}
        accept="image/jpeg,image/png,image/webp" allowedTypes={TYPES} maxFileSize={8 * 1024 * 1024} disabled={disabled}
        onLoadingChange={onLoadingChange} onError={setError} onUploadSuccess={url => { setError(''); onChange(url); }} />
    </div>
    <p className="session-cover-hint">Fotoğraf eklemeden de oturum oluşturabilirsiniz. JPEG, PNG veya WebP; en fazla 8 MB. Eklenen fotoğraf oturum kartında herkese görünür.</p>
    {value && value !== DEFAULT_SESSION_COVER && <Button variant="link" size="small" disabled={disabled} onClick={() => { setError(''); onChange(''); }}>Fotoğrafı kaldır</Button>}
    {error && <p className="ui-notice" role="alert">{error}</p>}
  </div>;
}
