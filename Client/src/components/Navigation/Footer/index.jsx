import React from 'react';
import { Link } from 'react-router-dom';
import { FiFeather, FiInstagram, FiTwitter, FiLinkedin, FiGithub } from 'react-icons/fi';

// --- UI KIT IMPORTS ---
import { Container } from '../../UI/Container';
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';

import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <Container maxWidth="7xl">
        
        {/* --- ÜST KISIM (Grid Yapısı) --- */}
        <div className="footer-grid">
          
          {/* 1. SÜTUN: MARKA & AÇIKLAMA */}
          <div className="footer-brand">
            <div className="footer-logo">
              <FiFeather className="brand-icon" />
              <Typography variant="h4" weight="bold" color="white">
                Quill
              </Typography>
            </div>
            <Typography variant="body" className="brand-desc">
              Hayalinizdeki kitabı gerçeğe dönüştüren, yazarları ve okurları buluşturan yeni nesil dijital yayıncılık platformu.
            </Typography>
            
            {/* Sosyal Medya İkonları */}
            <div className="social-links">
              <a href="#" className="social-icon"><FiInstagram /></a>
              <a href="#" className="social-icon"><FiTwitter /></a>
              <a href="#" className="social-icon"><FiLinkedin /></a>
              <a href="#" className="social-icon"><FiGithub /></a>
            </div>
          </div>

          {/* 2. SÜTUN: PLATFORM */}
          <div className="footer-column">
            <Typography variant="h6" weight="bold" color="white" className="col-title">
              Platform
            </Typography>
            <ul className="footer-links">
              <li><Link to="/feed">Keşfet</Link></li>
              <li><Link to="/create-book">Kitap Yaz</Link></li>
              <li><Link to="/authors">Yazarlar</Link></li>
              <li><Link to="/publishers">Yayınevleri</Link></li>
            </ul>
          </div>

          {/* 3. SÜTUN: KURUMSAL */}
          <div className="footer-column">
            <Typography variant="h6" weight="bold" color="white" className="col-title">
              Kurumsal
            </Typography>
            <ul className="footer-links">
              <li><Link to="/about">Hakkımızda</Link></li>
              <li><Link to="/contact">İletişim</Link></li>
              <li><Link to="/terms">Kullanım Koşulları</Link></li>
              <li><Link to="/privacy">Gizlilik Politikası</Link></li>
            </ul>
          </div>

          {/* 4. SÜTUN: BÜLTEN (Call to Action) */}
          <div className="footer-column">
            <Typography variant="h6" weight="bold" color="white" className="col-title">
              Haberdar Ol
            </Typography>
            <Typography variant="caption" className="newsletter-desc">
              Yeni çıkan kitaplar ve yazarlık ipuçları için bültenimize abone olun.
            </Typography>
            
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="E-posta adresiniz" 
                className="footer-input"
              />
              <Button variant="primary" size="medium" className="w-full">
                Abone Ol
              </Button>
            </form>
          </div>

        </div>

        {/* --- ALT KISIM (Copyright) --- */}
        <div className="footer-bottom">
          <Typography variant="caption" className="copyright-text">
            &copy; {new Date().getFullYear()} Quill Sanal Yayınevi. Tüm hakları saklıdır.
          </Typography>
        </div>

      </Container>
    </footer>
  );
};

export default Footer;