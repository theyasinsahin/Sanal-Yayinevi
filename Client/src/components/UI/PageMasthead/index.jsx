import React from 'react';
import './PageMasthead.css';

/**
 * Sayfa künyesi: dergi kapağı gibi etiket + dev Fraunces başlık + açıklama.
 * Keşfet, basılı kitaplar, alıntılar gibi liste sayfalarının üstünde kullanılır.
 * `title` içinde <em> turuncu italik vurgu olur.
 */
export const PageMasthead = ({ eyebrow, title, titleId, description, children, className = '' }) => (
  <header className={`page-masthead ${className}`}>
    <div className="page-masthead__inner">
      <div className="page-masthead__text">
        {eyebrow && <p className="page-masthead__eyebrow">{eyebrow}</p>}
        <h1 id={titleId} className="page-masthead__title">{title}</h1>
        {description && <p className="page-masthead__description">{description}</p>}
      </div>
      {children && <div className="page-masthead__aside">{children}</div>}
    </div>
  </header>
);

export default PageMasthead;
