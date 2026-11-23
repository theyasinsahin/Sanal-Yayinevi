import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Close, Person } from '@mui/icons-material';
import { FiMessageCircle } from 'react-icons/fi';

import MobileMenu from '../MobileMenu';
import { useAuth } from '../../../context/AuthContext';
import { Container } from '../../UI/Container';
import NotificationBell from '../../Notification/NotificationBell';
import { useUnreadMessageCount } from '../../../hooks/useMessages';
import Logo from '../../Logo';
import { canAccessPublisherPortal } from '../../../utils/publisher';

import './NavigationBar.css';

// Dergi künyesindeki bölümler gibi sıralanan ana gezinme bağlantıları
const SECTIONS = [
  { to: '/feed', label: 'Keşfet' },
  { to: '/quotes', label: 'Alıntılar' },
  { to: '/printed-books', label: 'Basılı Kitaplar' },
  { to: '/leaderboard', label: 'Aktiflik Tablosu' },
  { to: '/sessions', label: 'Oturumlar' },
];

const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

// Sayfa kaydırıldığında masthead yoğunlaşır (gölge + buzlu cam)
function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [offset]);
  return scrolled;
}

const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const scrolled = useScrolled();

  // Okunmamış mesaj sayısı — sadece giriş yapılmışsa çalışır
  const unreadCount = useUnreadMessageCount();

  return (
    <nav className={`navigation-bar${scrolled ? ' scrolled' : ''}`} aria-label="Ana gezinme">
      <Container maxWidth="7xl" className="h-full">
        <div className="nav-content">

          <Link to="/" className="nav-logo">
            <Logo />
            <span className="logo-wordmark">
              <span className="logo-text">Betik</span>
              <span className="logo-tagline" aria-hidden="true">Sanal Yayınevi</span>
            </span>
          </Link>

          <div className="desktop-menu">
            <div className="nav-links">
              {SECTIONS.map(section => (
                <NavLink key={section.to} to={section.to} className={navClass}>
                  {section.label}
                </NavLink>
              ))}
            </div>

            <div className="nav-actions">
              {canAccessPublisherPortal(user) && (
                <NavLink to="/publisher" className={navClass}>Yayınevi Portalı</NavLink>
              )}

              {user ? (
                <>
                  <Link to="/create-book" className="btn btn-primary btn-small">
                    Kitap Oluştur
                  </Link>

                  <Link to="/messages" className="nav-icon-btn" title="Mesajlar" aria-label="Mesajlar">
                    <FiMessageCircle aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="nav-icon-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  <NotificationBell />

                  <Link to="/profile" className="profile-btn" title="Profilim" aria-label="Profilim">
                    <Person aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <Link to="/login" className="btn btn-outline btn-small">
                  Giriş Yap
                </Link>
              )}
            </div>
          </div>

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

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
      />
    </nav>
  );
};

export default NavigationBar;
