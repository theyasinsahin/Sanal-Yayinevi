// src/components/Quote/QuotePopup/index.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { FormatQuote, Close, Check, Repeat } from '@mui/icons-material';
import { CREATE_QUOTE_MUTATION, REPOST_QUOTE_MUTATION } from '../../../graphql/mutations/quote';
import { CHECK_QUOTE_EXISTS } from '../../../graphql/queries/quote';
import './QuotePopup.css';

const QuotePopup = ({ bookId, chapterId, chapterTitle, chapterIndex }) => {
  const [popup, setPopup] = useState({ visible: false, x: 0, y: 0, text: '', location: null });
  const [note, setNote] = useState('');
  const [repostComment, setRepostComment] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingQuote, setExistingQuote] = useState(null); // çakışan alıntı
  const popupRef = useRef(null);

  const [isSpoiler, setIsSpoiler] = useState(false);
  const [repostIsSpoiler, setRepostIsSpoiler] = useState(false);

  const [createQuote, { loading: creating }] = useMutation(CREATE_QUOTE_MUTATION);
  const [repostQuote, { loading: reposting }] = useMutation(REPOST_QUOTE_MUTATION);
  const [checkQuote] = useLazyQuery(CHECK_QUOTE_EXISTS);

  useEffect(() => {
    const handleMouseUp = async (e) => {
      if (popupRef.current?.contains(e.target)) return;
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (!selectedText || selectedText.length < 10) {
        setPopup(p => ({ ...p, visible: false }));
        setExistingQuote(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Çakışma kontrolü
      const { data } = await checkQuote({
        variables: { text: selectedText, bookId }
      });

      const existing = data?.checkQuoteExists?.exists ? data.checkQuoteExists.quote : null;
      setExistingQuote(existing);

      setPopup({
        visible: true,
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 10,
        text: selectedText,
        location: { startOffset: range.startOffset, endOffset: range.endOffset }
      });
      setSaved(false);
      setShowNoteInput(false);
      setNote('');
      setRepostComment('');
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [bookId, checkQuote]);

  const handleSave = async () => {
    try {
      await createQuote({
        variables: {
          text: popup.text, note: note.trim() || null,
          bookId, chapterId, chapterTitle, chapterIndex, location: popup.location, isSpoiler: isSpoiler
        }
      });
      setSaved(true);
      closePopup();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepost = async () => {
    if (!existingQuote) return;
    try {
      await repostQuote({
        variables: { originalQuoteId: existingQuote.id, repostComment: repostComment.trim() || null, isSpoiler: repostIsSpoiler }
      });
      setSaved(true);
      closePopup();
    } catch (err) {
      console.error(err.message);
    }
  };

  const closePopup = () => {
    setTimeout(() => {
      setPopup(p => ({ ...p, visible: false }));
      setExistingQuote(null);
      setShowNoteInput(false);
      setNote('');
      setRepostComment('');
      window.getSelection()?.removeAllRanges();
    }, 1200);
  };

  const handleClose = () => {
    setPopup(p => ({ ...p, visible: false }));
    setExistingQuote(null);
    setShowNoteInput(false);
    window.getSelection()?.removeAllRanges();
  };

  if (!popup.visible) return null;

  return (
    <div
      ref={popupRef}
      className="quote-popup"
      style={{ left: `${popup.x}px`, top: `${popup.y}px` }}
    >
      {saved ? (
        <div className="quote-popup-saved">
          <Check fontSize="small" /> {existingQuote ? 'Repost edildi!' : 'Alıntı kaydedildi!'}
        </div>
      ) : existingQuote ? (
        /* Mevcut alıntı var — Repost UI */
        <div className="quote-popup-existing">
          <div className="quote-popup-existing-header">
            <Repeat fontSize="small" style={{ color: '#f59e0b' }} />
            <span>Bu alıntı zaten var!</span>
            <button className="quote-popup-btn ghost" onClick={handleClose}>
              <Close fontSize="small" />
            </button>
          </div>
          <p className="quote-popup-existing-info">
            <strong>@{existingQuote.user?.username}</strong> tarafından alıntılandı.
            Repostlayarak destek verebilirsin.
          </p>

          {existingQuote.repostedBy?.includes(existingQuote.user?.id) ? (
            <p className="quote-popup-already-reposted">Zaten repostladınız.</p>
          ) : (
            <>
              <textarea
                className="quote-note-input"
                placeholder="Repost yorumu ekle... (opsiyonel)"
                value={repostComment}
                onChange={(e) => setRepostComment(e.target.value)}
                rows={2}
              />
              <label className="quote-spoiler-checkbox">
                <input
                  type="checkbox"
                  checked={repostIsSpoiler}
                  onChange={(e) => setRepostIsSpoiler(e.target.checked)}
                />
                <span>⚠️ Bu alıntı spoiler içeriyor</span>
              </label>
              <button
                className="quote-popup-btn primary full"
                onClick={handleRepost}
                disabled={reposting}
              >
                <Repeat fontSize="small" />
                {reposting ? 'Repostlanıyor...' : 'Repostla'}
              </button>
            </>
          )}
        </div>
      ) : (
        /* Normal alıntı UI */
        <>
          <div className="quote-popup-actions">
            <button className="quote-popup-btn primary" onClick={() => setShowNoteInput(!showNoteInput)}>
              <FormatQuote fontSize="small" />
              Alıntıla
            </button>
            <button className="quote-popup-btn ghost" onClick={handleClose}>
              <Close fontSize="small" />
            </button>
          </div>
          {showNoteInput && (
            <div className="quote-popup-note">
              <textarea
                placeholder="Notunuzu ekleyin... (opsiyonel)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="quote-note-input"
                autoFocus
              />
              {/* Spoiler checkbox */}
              <label className="quote-spoiler-checkbox">
                <input
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(e) => setIsSpoiler(e.target.checked)}
                />
                <span>⚠️ Bu alıntı spoiler içeriyor</span>
              </label>
              <button className="quote-popup-btn primary full" onClick={handleSave} disabled={creating}>
                {creating ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuotePopup;