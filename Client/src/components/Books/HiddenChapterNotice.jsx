import React from 'react';
import { Link } from 'react-router-dom';
import { chapterLengthLabel } from '../../utils/chapterVisibility';
import './HiddenChapterNotice.css';

export default function HiddenChapterNotice({ chapter, bookId }) {
  return <section className="hidden-chapter-notice" aria-label="Gizli bölüm">
    <h3>Bu bölüm okuyuculara kapalı</h3>
    <p>{chapterLengthLabel(chapter)}</p>
    <p>Yazar bu bölümün içeriğini gizledi. Yeniden erişime açıldığında okuyabilirsiniz.</p>
    <Link to={`/donate/${bookId}`} className="ui-text-link" onClick={event => event.stopPropagation()}>Kitaba destek ol</Link>
  </section>;
}
