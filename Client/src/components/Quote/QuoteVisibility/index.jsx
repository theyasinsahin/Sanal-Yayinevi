import React from 'react';
import './QuoteVisibility.css';

export default function QuoteVisibility({ value, onChange, disabled = false, id = 'quote-visibility' }) {
  return <div className="quote-visibility">
    <label htmlFor={id}>Alıntı görünürlüğü</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} aria-describedby={`${id}-hint`}>
      <option value="PUBLIC">Herkese açık</option>
      <option value="PRIVATE">Sadece ben (özel)</option>
    </select>
    <p id={`${id}-hint`}>{value === 'PRIVATE' ? 'Bu alıntıyı ve notunu yalnızca sen görebilirsin.' : 'Bu alıntı diğer okurlara görünür ve paylaşılabilir.'}</p>
  </div>;
}
