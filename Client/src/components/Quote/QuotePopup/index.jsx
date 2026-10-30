import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Check, Close, Repeat } from '@mui/icons-material';
import { CREATE_QUOTE_MUTATION, REPOST_QUOTE_MUTATION } from '../../../graphql/mutations/quote';
import { CHECK_QUOTE_EXISTS } from '../../../graphql/queries/quote';
import { useAuth } from '../../../context/AuthContext';
import { invalidateQuoteLists } from '../../../utils/quoteCache';
import QuoteVisibility from '../QuoteVisibility';
import './QuotePopup.css';

export default function QuotePopup({ bookId, chapterId, chapterTitle, chapterIndex }) {
  const { user } = useAuth();
  const [popup, setPopup] = useState({ visible: false });
  const [visibility, setVisibility] = useState('PUBLIC');
  const [note, setNote] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const popupRef = useRef(null), generation = useRef(0), closeTimer = useRef(null);
  const [checkQuote] = useLazyQuery(CHECK_QUOTE_EXISTS, { fetchPolicy: 'network-only' });
  const [createQuote, { loading: creating }] = useMutation(CREATE_QUOTE_MUTATION, { update: invalidateQuoteLists });
  const [repostQuote, { loading: reposting }] = useMutation(REPOST_QUOTE_MUTATION, { update: invalidateQuoteLists });

  async function check(text, selectedVisibility) {
    const request = ++generation.current;
    setChecking(true); setCheckFailed(false); setExisting(null); setError('');
    try {
      const { data } = await checkQuote({ variables: { text, bookId, visibility: selectedVisibility } });
      if (request === generation.current) setExisting(data?.checkQuoteExists?.quote || null);
    } catch (failure) {
      if (request === generation.current) { setCheckFailed(true); setError('Alıntı kontrol edilemedi. Yeniden deneyin.'); }
    } finally { if (request === generation.current) setChecking(false); }
  }

  useEffect(() => {
    const selectText = event => {
      if (popupRef.current?.contains(event.target)) return;
      const selection = window.getSelection(), text = selection?.toString().trim();
      if (!text || text.length < 10 || !selection.rangeCount) { generation.current++; setPopup({ visible: false }); return; }
      const range = selection.getRangeAt(0), rect = range.getBoundingClientRect();
      clearTimeout(closeTimer.current); setSaved(false); setNote(''); setSpoiler(false);
      setPopup({ visible: true, text, x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom ?? rect.top + 20,
        location: { startOffset: range.startOffset, endOffset: range.endOffset } });
      check(text, visibility);
    };
    document.addEventListener('mouseup', selectText);
    return () => document.removeEventListener('mouseup', selectText);
    // Selection checks are scoped by the current book and visibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, visibility, checkQuote]);
  useEffect(() => () => { generation.current++; clearTimeout(closeTimer.current); }, []);
  useLayoutEffect(() => {
    const element = popupRef.current;
    if (!element || !popup.visible) return;
    const navbar = document.querySelector('.navigation-bar');
    const position = () => {
      const topBoundary = Math.max(8, (navbar?.getBoundingClientRect().bottom || 0) + 8);
      const viewportBottom = window.visualViewport
        ? Math.min(window.innerHeight, window.visualViewport.offsetTop + window.visualViewport.height)
        : window.innerHeight;
      element.style.maxHeight = `${Math.max(0, viewportBottom - topBoundary - 8)}px`;
      const { width, height } = element.getBoundingClientRect();
      const left = Math.max(8, Math.min(popup.x - width / 2, window.innerWidth - width - 8));
      const above = popup.y - height - 10;
      const top = above >= topBoundary ? above : Math.max(topBoundary, Math.min(popup.bottom + 10, viewportBottom - height - 8));
      element.style.left = `${left}px`; element.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(position) : null;
    if (navbar) observer?.observe(navbar);
    return () => {
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      observer?.disconnect();
    };
  });

  function close() {
    generation.current++; clearTimeout(closeTimer.current); setPopup({ visible: false }); window.getSelection()?.removeAllRanges();
  }
  async function save() {
    setError('');
    try {
      if (existing && visibility === 'PUBLIC') await repostQuote({ variables: { originalQuoteId: existing.id, repostComment: note.trim() || null, isSpoiler: spoiler } });
      else await createQuote({ variables: { text: popup.text, note: note.trim() || null, bookId, chapterId, chapterTitle, chapterIndex,
        location: popup.location, isSpoiler: spoiler, visibility } });
      setSaved(true); closeTimer.current = setTimeout(close, 1200);
    } catch (failure) { setError(failure.message.includes('QUOTE_EXISTS:') ? 'Bu alıntı seçtiğiniz görünürlükle zaten kaydedilmiş.' : failure.message); }
  }

  if (!popup.visible) return null;
  const duplicateOwned = existing && (visibility === 'PRIVATE' || existing.user?.id === user?.id);
  const reposted = existing?.repostedBy?.includes(user?.id);
  const busy = creating || reposting;
  return <div ref={popupRef} className="quote-popup" style={{ left: `${popup.x}px`, top: `${popup.y}px` }} role="dialog" aria-label="Alıntı kaydet">
    <div className="quote-popup-actions"><strong>Alıntı kaydet</strong><button type="button" className="quote-popup-btn ghost" onClick={close} aria-label="Alıntı penceresini kapat"><Close fontSize="small" /></button></div>
    {saved ? <div className="quote-popup-saved" role="status"><Check fontSize="small" />{visibility === 'PRIVATE' ? 'Özel alıntı kaydedildi!' : 'Alıntı kaydedildi!'}</div> : <>
      <QuoteVisibility value={visibility} disabled={busy} id="reader-quote-visibility" onChange={value => { setVisibility(value); check(popup.text, value); }} />
      {checking && <p role="status">Alıntı kontrol ediliyor…</p>}
      {error && <p role="alert">{error}</p>}
      {checkFailed && <button type="button" className="quote-popup-btn" onClick={() => check(popup.text, visibility)}>Yeniden kontrol et</button>}
      {duplicateOwned || reposted ? <p>Bu alıntı zaten kayıtlı. <Link to="/profile">Profilimdeki alıntılar</Link></p> : <>
        {existing && <p className="quote-popup-existing-info"><Repeat fontSize="small" /> Bu alıntı @{existing.user?.username} tarafından paylaşılmış. Yeniden paylaşabilir veya “Sadece ben” seçerek özel kaydedebilirsin.</p>}
        <textarea className="quote-note-input" aria-label={existing ? 'Yeniden paylaşım notu' : 'Alıntı notu'} placeholder="Not ekle... (isteğe bağlı)" value={note} onChange={event => setNote(event.target.value)} rows={2} disabled={busy} />
        <label className="quote-spoiler-checkbox"><input type="checkbox" checked={spoiler} onChange={event => setSpoiler(event.target.checked)} disabled={busy} />Sürprizbozan içeriyor</label>
        <button type="button" className="quote-popup-btn primary full" disabled={busy || checking || checkFailed} onClick={save}>
          {busy ? 'Kaydediliyor…' : visibility === 'PRIVATE' ? 'Özel olarak kaydet' : existing ? 'Yeniden paylaş' : 'Kaydet'}
        </button>
      </>}
    </>}
  </div>;
}
