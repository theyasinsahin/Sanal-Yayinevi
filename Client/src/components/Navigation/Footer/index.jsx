import React from 'react';
import { Link } from 'react-router-dom';
import Newsletter from './Newsletter';
import SocialLinks from './SocialLinks';
import { Container } from '../../UI/Container';
import Logo from '../../Logo';

import './Footer.css';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { to: '/feed', label: 'Keşfet' },
      { to: '/create-book', label: 'Kitap Yaz' },
      { to: '/authors', label: 'Yazarlar' },
      { to: '/printed-books', label: 'Basılı Kitaplar' },
    ],
  },
  {
    title: 'Kurumsal',
    links: [
      { to: '/about', label: 'Hakkımızda' },
      { to: '/contact', label: 'İletişim' },
      { to: '/terms', label: 'Kullanım Koşulları' },
      { to: '/privacy', label: 'Gizlilik Politikası' },
    ],
  },
];

const Footer = () => (
  <footer className="footer cinema-band">
    <Container maxWidth="7xl">

      {/* Kapanış sahnesi: büyük edebi cümle + çağrı */}
      <div className="footer-curtain">
        <p className="footer-curtain-eyebrow">Son söz</p>
        <p className="footer-curtain-title">
          Her büyük kitap <em>bir taslakla</em> başlar.
        </p>
        <Link to="/create-book" className="btn btn-primary btn-large footer-curtain-cta">
          Yazmaya başla
        </Link>
      </div>

      <div className="footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <Logo variant="light" />
            <span className="footer-logo-text">Betik</span>
          </Link>
          <p className="brand-desc">
            Hayalinizdeki kitabı gerçeğe dönüştüren, yazarları ve okurları buluşturan yeni nesil dijital yayıncılık platformu.
          </p>
          <SocialLinks />
        </div>

        {COLUMNS.map(column => (
          <nav className="footer-column" key={column.title} aria-label={column.title}>
            <h2 className="col-title">{column.title}</h2>
            <ul className="footer-links">
              {column.links.map(link => (
                <li key={link.to}><Link to={link.to}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="footer-column footer-newsletter">
          <h2 className="col-title">Haberdar Ol</h2>
          <p className="newsletter-desc">
            Yeni çıkan kitaplar ve yazarlık ipuçları için bültenimize abone olun.
          </p>
          <Newsletter />
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright-text">
          &copy; {new Date().getFullYear()} Betik. Tüm hakları saklıdır.
        </p>
        <p className="footer-colophon">Yaz · Oku · Destekle · Bastır</p>
      </div>

    </Container>
  </footer>
);

export default Footer;
