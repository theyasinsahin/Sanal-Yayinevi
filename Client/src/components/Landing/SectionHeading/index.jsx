import React from 'react';
import './SectionHeading.css';

/**
 * Dergi bölüm başlığı: "01 / Seçki" etiketi, Fraunces başlık, açıklama
 * ve sağda isteğe bağlı bağlantı. `tone="light"` bordo bantlar içindir.
 */
const SectionHeading = ({ number, eyebrow, title, titleId, description, descriptionProps = {}, action, tone = 'default', className = '' }) => (
  <header className={`section-heading section-heading--${tone} ${className}`}>
    <div className="section-heading__text">
      {(number || eyebrow) && (
        <p className="section-heading__eyebrow">
          {number && <span className="section-heading__number">{number}</span>}
          {eyebrow}
        </p>
      )}
      <h2 id={titleId} className="section-heading__title">{title}</h2>
      {description && <p className="section-heading__description" {...descriptionProps}>{description}</p>}
    </div>
    {action && <div className="section-heading__action">{action}</div>}
  </header>
);

export default SectionHeading;
