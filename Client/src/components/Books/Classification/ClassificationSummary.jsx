import React from 'react';
import './Classification.css';

export default function ClassificationSummary({ book, compact = false }) {
  const main = [book.format, ...(book.genres || []).slice(0, compact ? 2 : 3)].filter(Boolean);
  if (compact) return main.length ? <div className="classification-summary">{main.map(item => <span key={item.id}>{item.name}</span>)}</div> : null;
  return <section className="classification-detail" aria-label="Eser sınıflandırması">
    <h3>Eser hakkında</h3>
    {book.classificationStatus !== 'COMPLETE' && <p>Sınıflandırma bilgileri henüz tamamlanmadı.</p>}
    <dl><dt>Eser biçimi</dt><dd>{book.format?.name || 'Belirtilmedi'}</dd>
      <dt>Tür ve konular</dt><dd>{book.genres?.map(item => item.name).join(', ') || 'Belirtilmedi'}</dd>
      <dt>Etiketler</dt><dd>{book.classificationTags?.map(item => item.name).join(', ') || 'Belirtilmedi'}</dd>
      <dt>Anlatım özellikleri</dt><dd>{book.narrativeFeatures?.map(item => item.name).join(', ') || 'Belirtilmedi'}</dd>
      <dt>Hedef okur kitlesi</dt><dd>{book.targetAudience?.name || 'Belirtilmedi'}</dd>
      <dt>İçerik uyarıları</dt><dd>{book.contentWarnings?.map(item => item.name).join(', ') || 'Belirtilmedi'}</dd></dl>
    <p className="classification-hint">Uyarı bulunmaması her yaşa uygunluk onayı değildir.</p>
  </section>;
}
