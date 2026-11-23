import React from 'react';
import './AuthQuotePanel.css';

// Betik'in kendi cümleleri: her sayfa kendi bağlamına uygun bir söz gösterir
const LINES = {
  login: { lead: 'Kaldığın sayfa', accent: 'seni bekliyor.' },
  register: { lead: 'Her büyük kitap', accent: 'bir taslakla başlar.' },
  forgot: { lead: 'Unutulan şifre,', accent: 'unutulan hikâye değil.' },
  reset: { lead: 'Yeni bir sayfa,', accent: 'yeni bir başlangıç.' },
};

/**
 * Giriş/kayıt sayfalarının solundaki bordo sinematik panel.
 * Tamamen dekoratiftir; ekran okuyucular formdaki başlığı okur.
 */
const AuthQuotePanel = ({ variant = 'login' }) => {
  const line = LINES[variant] || LINES.login;
  return (
    <aside className="auth-quote-panel cinema-band" aria-hidden="true">
      <p className="auth-quote-eyebrow">Betik · Sanal Yayınevi</p>
      <p className="auth-quote-text">
        {line.lead} <em>{line.accent}</em>
      </p>
      <ul className="auth-quote-steps">
        <li><span>01</span> Yaz</li>
        <li><span>02</span> Oku</li>
        <li><span>03</span> Destekle</li>
        <li><span>04</span> Bastır</li>
      </ul>
    </aside>
  );
};

export default AuthQuotePanel;
