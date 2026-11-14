import React, { useEffect, useRef, useState } from 'react';
import ChapterAudio from './ChapterAudio';
import { changeChapterMusic, readMusicDuration, validateMusicFile } from './api';

export default function ChapterMusicEditor({ chapterId, music, onChange, disabled }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const inputRef = useRef(null);
  const update = async removing => {
    if (pending.current || disabled) return;
    if (!removing && (!file || !rights)) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!removing) { validateMusicFile(file); await readMusicDuration(file); }
      const next = await changeChapterMusic(chapterId, removing ? null : file, title);
      onChange(chapterId, next);
      if (!mounted.current) return;
      setFile(null); setRights(false); setTitle('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <section className="chapter-music-editor" aria-label="Bölüm müziği düzenle" aria-busy={busy}>
    <h3>Bölüm müziği</h3>
    <p>Tek MP3 · En fazla 15 MiB ve 10 dakika. Okuyucu müziği kendisi başlatır.</p>
    {music?.url && <><ChapterAudio key={music.url} music={music} />
      <button type="button" disabled={busy || disabled} onClick={() => update(true)}>Müziği kaldır</button></>}
    <fieldset disabled={busy || disabled}>
      <legend>{music ? 'Müziği değiştir' : 'Müzik ekle'}</legend>
      <label>MP3 dosyası<input ref={inputRef} type="file" accept=".mp3,audio/mpeg" onChange={event => {
        const chosen = event.target.files?.[0]; setError(''); setFile(null); setRights(false);
        if (!chosen) return;
        try { validateMusicFile(chosen); setFile(chosen); } catch (failure) { setError(failure.message); }
      }} /></label>
      <label>Müzik başlığı (isteğe bağlı)<input type="text" maxLength={160} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /> Bu müziği paylaşmak için gerekli haklara ve izinlere sahibim.</label>
      <button type="button" disabled={!file || !rights} onClick={() => update(false)}>Müziği yükle</button>
    </fieldset>
    {busy && <p role="status">Müzik işleniyor...</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
