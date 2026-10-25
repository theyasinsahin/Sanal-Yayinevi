import React, { useState } from 'react';
import IosShare from '@mui/icons-material/IosShare';
import { Button } from '../UI/Button';
import SocialShareDialog from './SocialShareDialog';

export default function SocialShareButton({ type, id, label = 'Paylaş', beforeOpen, onSendInBetik, disabled, className = '', size = 'small', variant = 'outline' }) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  async function show(event) {
    event.stopPropagation(); setError(''); setPreparing(true);
    try { if (beforeOpen) await beforeOpen(); setOpen(true); }
    catch { setError('Değişiklikler kaydedilemedi. Paylaşmadan önce kaydı yeniden deneyin.'); }
    finally { setPreparing(false); }
  }
  return <><Button variant={variant} size={size} className={className} icon={<IosShare fontSize="small" />} onClick={show} disabled={disabled || !id || preparing} aria-label={label}>{label}</Button>{error && <span className="social-share-inline-error" role="alert">{error}</span>}{open && <SocialShareDialog target={{ type, id }} onClose={() => setOpen(false)} onSendInBetik={onSendInBetik} />}</>;
}
