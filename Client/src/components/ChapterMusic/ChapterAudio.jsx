import React, { useEffect, useRef, useState } from 'react';
import './ChapterMusic.css';

export default function ChapterAudio({ music }) {
  const audioRef = useRef(null);
  const [loop, setLoop] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) { audio.pause(); audio.currentTime = 0; audio.removeAttribute('src'); audio.load(); }
    };
  }, []);
  return <div className="chapter-audio" role="group" aria-label="Bölüm müziği">
    <span>{music.title || 'Bölüm müziği'}</span>
    <audio ref={audioRef} src={music.url} controls preload="none" loop={loop} aria-label="Bölüm müziğini dinle" />
    <label><input type="checkbox" checked={loop} onChange={event => setLoop(event.target.checked)} /> Tekrarla</label>
  </div>;
}
