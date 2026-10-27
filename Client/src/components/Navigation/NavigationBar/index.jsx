import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Close, Person } from '@mui/icons-material';
import { FiMessageCircle } from 'react-icons/fi';

// --- BİLEŞENLER & HOOKS ---
import MobileMenu from '../MobileMenu'; // Bir sonraki adımda düzenleyeceğiz
import { useAuth } from '../../../context/AuthContext';

// --- UI KIT ---
import { Container } from '../../UI/Container';
import { Button } from '../../UI/Button';
import { Typography } from '../../UI/Typography';

import NotificationBell from '../../Notification/NotificationBell';
import { useUnreadMessageCount } from '../../../hooks/useMessages';


import './NavigationBar.css';
import Logo from '../../Logo';




const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth(); 

  // Okunmamış mesaj sayısı — sadece giriş yapılmışsa çalışır
  const unreadCount = useUnreadMessageCount();

  return (
    <nav className="navigation-bar">
      {/* İçeriği diğer sayfalarla hizalamak için Container kullanıyoruz */}
      <Container maxWidth="7xl" className="h-full">
        <div className="nav-content">
          
          {/* --- LOGO --- */}
          <Link to="/" className="nav-logo">
            <Logo />

            <Typography
              variant="h4"
              weight="bold"
              className="logo-text"
            >
              Betik
            </Typography>
          </Link>

          {/* --- DESKTOP MENU --- */}
          <div className="desktop-menu">
            <div className="nav-links">
              {/* Normal Link */}
              <Link to="/feed" className="nav-item">
                <Typography variant="body" weight="medium">Keşfet</Typography>
              </Link>

              <Link to="/quotes" className="nav-item">
                <Typography variant="body" weight="medium">Alıntılar</Typography>
              </Link>
              <Link to="/printed-books" className="nav-item">
                <Typography variant="body" weight="medium">Basılı Kitaplar</Typography>
              </Link>

              <Link to="/leaderboard" className="nav-item">
                <Typography variant="body" weight="medium">Lider Tablosu</Typography>
              </Link>

              <Link to="/sessions" className="nav-item">
                <Typography variant="body" weight="medium">Oturumlar</Typography>
              </Link>
            </div>
            <div className="nav-actions">
              {/* KULLANICI KONTROLÜ */}
              {user ? (
                <>
                  {/* Kitap Oluştur Butonu */}
                  <Link to="/create-book" style={{ textDecoration: 'none' }}>
                    <Button variant="primary" size="small">
                      Kitap Oluştur
                    </Button>
                  </Link>

                  {/* Mesaj ikonu */}
                  <Link to="/messages" className="nav-icon-btn" title="Mesajlar" aria-label="Mesajlar">
                    <FiMessageCircle />
                    {unreadCount > 0 && (
                      <span className="nav-icon-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  <NotificationBell />
                  <Link to="/funding-history" className="nav-item">Desteklerim</Link>

                  {/* Profil İkonu */}
                  <Link to="/profile" className="profile-btn" title="Profilim">
                    <Person />
                  </Link>

                </>
              ) : (
                // --- GİRİŞ YAPMAMIŞSA ---
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" size="small">
                    Giriş Yap
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* --- MOBILE TOGGLE --- */}
          <button 
            type="button"
            className="mobile-toggle-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menüyü Aç/Kapat"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <Close /> : <Menu />}
          </button>

        </div>
      </Container>

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        user={user} 
      />
    </nav>
  );
};

export default NavigationBar;
