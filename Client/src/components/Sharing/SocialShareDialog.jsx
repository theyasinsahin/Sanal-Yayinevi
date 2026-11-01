import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@apollo/client';
import { Button } from '../UI/Button';
import { GET_SOCIAL_SHARE } from '../../graphql/socialShare';
import { shareLinks, loadShareFile, copyShareText, canShareImage } from '../../utils/socialSharing';
import './SocialShare.css';

export default function SocialShareDialog({ target, onClose, onSendInBetik }) {
  const headingId = useId();
  const dialogRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [sharing, setSharing] = useState(false);
  const { data, loading, error, refetch } = useQuery(GET_SOCIAL_SHARE, { variables: { type: target.type, id: target.id }, fetchPolicy: 'network-only' });
  const item = data?.getSocialShare;
  const links = useMemo(() => item ? shareLinks(item) : null, [item]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);
  useEffect(() => {
    if (!item || !links) return undefined;
    const controller = new AbortController();
    let active = true, objectUrl;
    setFile(null); setFileUrl(''); setImageError('');
    loadShareFile(item, links, controller.signal).then(image => {
      if (!active) return;
      objectUrl = URL.createObjectURL(image); setFile(image); setFileUrl(objectUrl);
    }).catch(failure => { if (active) setImageError(failure.message); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item, links, attempt]);

  const keyDown = event => {
    if (event.key === 'Escape' && !sharing) { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input, textarea')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  async function copy(value, success) {
    setActionError(''); setMessage('');
    try { await copyShareText(value); setMessage(success); }
    catch (failure) { setActionError(failure.message); }
  }
  async function nativeShare(withImage) {
    setActionError(''); setMessage(''); setSharing(true);
    try {
      // The file is prepared before the click, preserving user activation.
      await navigator.share(withImage ? { files: [file], title: item.title, text: links.text } : { title: item.title, text: links.caption, url: links.url });
      setMessage('Cihazın paylaşım menüsüne aktarıldı.');
    } catch (failure) {
      if (failure.name !== 'AbortError') setActionError('Paylaşım menüsü açılamadı. WhatsApp, indirme veya kopyalama seçeneklerini kullanabilirsiniz.');
    } finally { setSharing(false); }
  }
  return createPortal(<div className="social-share-overlay" onClick={event => { if (event.target === event.currentTarget && !sharing) onClose(); }}>
    <section className="social-share-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={keyDown} ref={dialogRef}>
      <header className="social-share-header"><h2 id={headingId}>Paylaş</h2><Button variant="ghost" size="small" onClick={onClose} disabled={sharing} aria-label="Paylaşım penceresini kapat">Kapat</Button></header>
      {loading && <p role="status">Paylaşım hazırlanıyor…</p>}
      {error && <div className="ui-notice ui-notice--error" role="alert"><p>{error.message}</p><Button variant="outline" onClick={() => refetch().catch(() => {})}>Yeniden dene</Button></div>}
      {item && links && <>
        <div className="social-share-preview"><img src={fileUrl || links.imageUrl} onError={event => { if (event.currentTarget.src !== links.fallbackImageUrl) event.currentTarget.src = links.fallbackImageUrl; }} alt="Paylaşım görseli" /><div><h3>{item.title}</h3><p>{item.description}</p></div></div>
        <div className="social-share-actions">
          <a className="btn btn-primary btn-medium" href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="btn btn-outline btn-medium" href={links.telegram} target="_blank" rel="noopener noreferrer">Telegram</a>
          <a className="btn btn-outline btn-medium" href={links.x} target="_blank" rel="noopener noreferrer">X’te paylaş</a>
          {typeof navigator.share === 'function' && <Button variant="outline" onClick={() => nativeShare(false)} disabled={sharing}>Diğer uygulamalar</Button>}
          <Button variant="outline" onClick={() => copy(links.url, 'Bağlantı kopyalandı.')}>Bağlantıyı kopyala</Button>
        </div>
        <section className="social-share-story"><h3>Story / Durum için</h3><p>Görseli indirip story veya durum olarak kullanabilirsiniz. Instagram’da bağlantıyı “Bağlantı” etiketine ekleyin.</p>
          <div className="social-share-actions">
            {fileUrl ? <a className="btn btn-outline btn-medium" href={fileUrl} download={file.name}>Görseli indir</a> : !imageError && <span role="status">Görsel hazırlanıyor…</span>}
            {canShareImage(file, links.text) && <Button variant="outline" onClick={() => nativeShare(true)} disabled={sharing}>Görsel ve bağlantıyı paylaş</Button>}
            <Button variant="ghost" onClick={() => copy(links.text, 'Paylaşım metni ve bağlantı kopyalandı.')}>Metin ve bağlantıyı kopyala</Button>
          </div>
          {imageError && <div className="ui-notice" role="alert"><p>{imageError}</p><Button variant="outline" size="small" onClick={() => setAttempt(value => value + 1)}>Görseli tekrar yükle</Button></div>}
        </section>
        <label className="social-share-link-label">Paylaşım bağlantısı<input readOnly value={links.url} onFocus={event => event.target.select()} /></label>
      </>}
      {onSendInBetik && <div className="social-share-actions"><Button variant="outline" onClick={() => { onClose(); onSendInBetik(); }}>Betik’te mesajla gönder</Button></div>}
      {message && <p className="ui-notice ui-notice--success" role="status">{message}</p>}
      {actionError && <p className="ui-notice ui-notice--error" role="alert">{actionError}</p>}
    </section>
  </div>, document.body);
}
