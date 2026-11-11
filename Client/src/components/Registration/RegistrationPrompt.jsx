import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { REGISTRATION_PROMPT, registrationUrl, saveRegistrationIntent } from '../../utils/registrationIntent';
import './RegistrationPrompt.css';

const messages = {
  read: ['Hikâyeye devam et', 'Sonraki bölümleri okumak için ücretsiz hesap oluştur.'],
  save: ['Bu kitabı kitaplığında sakla', 'Kitaplarını bir arada tutmak için ücretsiz hesap oluştur.'],
  follow: ['Yeni bölümlerden haberdar ol', 'Kitabı takip etmek için ücretsiz hesap oluştur.'],
  like: ['Beğenini paylaş', 'Beğenmek için ücretsiz hesap oluştur.'],
  comment: ['Sohbete katıl', 'Yorumunu paylaşmak için ücretsiz hesap oluştur.'],
  quote: ['Beğendiğin satırları sakla', 'Alıntılarını kaydetmek için ücretsiz hesap oluştur.'],
  bookmark: ['Kaldığın yeri kaybetme', 'Ayracını hesabına kaydetmek için ücretsiz hesap oluştur.'],
  repost: ['Alıntıyı yeniden paylaş', 'Bu alıntıyı paylaşmak için ücretsiz hesap oluştur.'],
  'printed-reading': ['Okuduğun kitapları bir arada tut', 'Kitabı okuduklarına eklemek ve puan vermek için ücretsiz hesap oluştur.'],
  recommendations: ['Sana özel kitaplar keşfet', 'İlgi alanlarına uygun öneriler için ücretsiz hesap oluştur.'],
};

export function RegistrationCard({ intent, children, titleId }) {
  const generatedId = useId();
  const [title, description] = messages[intent.action === 'comment-like' ? 'like' : intent.action] || messages.comment;
  const persist = () => saveRegistrationIntent(intent);
  return <section className="registration-card" aria-label="Ücretsiz üyelik">
    <h2 id={titleId || generatedId}>{title}</h2>
    <p>{intent.bookTitle && <strong>“{intent.bookTitle}” · </strong>}{description}</p>
    <div className="registration-actions">
      <Link className="registration-primary" to={registrationUrl('register', intent)} onClick={persist}>Ücretsiz hesap oluştur</Link>
      <Link className="ui-text-link" to={registrationUrl('login', intent)} onClick={persist}>Zaten hesabım var — Giriş yap</Link>
      {children}
    </div>
  </section>;
}

export default function RegistrationPrompt() {
  const [intent, setIntent] = useState(null);
  const dialog = useRef(null);
  const location = useLocation();
  useEffect(() => {
    const open = event => setIntent(current => current || event.detail);
    window.addEventListener(REGISTRATION_PROMPT, open);
    return () => window.removeEventListener(REGISTRATION_PROMPT, open);
  }, []);
  useEffect(() => { setIntent(null); }, [location]);
  useEffect(() => {
    if (!intent) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...dialog.current.querySelectorAll('a[href], button:not(:disabled)')];
    controls()[0]?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setIntent(null); }
      if (event.key !== 'Tab') return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey, true); previous?.focus?.({ preventScroll: true }); };
  }, [intent]);
  if (!intent) return null;
  return <div className="registration-backdrop" onClick={() => setIntent(null)}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="registration-dialog-title" className="registration-dialog" onClick={event => event.stopPropagation()}>
      <RegistrationCard intent={intent} titleId="registration-dialog-title"><button className="ui-text-link" onClick={() => setIntent(null)}>Şimdilik geri dön</button></RegistrationCard>
    </div>
  </div>;
}
