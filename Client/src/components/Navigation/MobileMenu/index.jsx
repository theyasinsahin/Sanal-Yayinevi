import React, { useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Create,
  Person,
  Login,
  Logout,
  AppRegistration,
  MenuBook,
} from '@mui/icons-material';
import { FiMessageCircle } from 'react-icons/fi';

import { useAuth } from '../../../context/AuthContext';
import { useUnreadMessageCount } from '../../../hooks/useMessages';
import { Button } from '../../UI/Button';
import NotificationBell from '../../Notification/NotificationBell';
import { canAccessPublisherPortal } from '../../../utils/publisher';

import './MobileMenu.css';

// Masaüstü menüyle birebir aynı bölümler; dergi içindekiler sayfası gibi numaralı
const SECTIONS = [
  { to: '/feed', label: 'Keşfet' },
  { to: '/quotes', label: 'Alıntılar' },
  { to: '/printed-books', label: 'Basılı Kitaplar' },
  { to: '/leaderboard', label: 'Aktiflik Tablosu' },
  { to: '/sessions', label: 'Oturumlar' },
];

const sectionClass = ({ isActive }) => `mobile-section-link${isActive ? ' active' : ''}`;
const itemClass = ({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`;

const MobileMenu = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Okunmamış mesaj sayısı — desktop navbar'daki ile aynı hook
  const unreadCount = useUnreadMessageCount();

  // Escape ile kapanır
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  return (
    <>
      <div
        className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Kapalıyken CSS visibility:hidden ile odak sırasından çıkar */}
      <div className={`mobile-menu-drawer ${isOpen ? 'open' : ''}`}>
        <div className="mobile-menu-content">

          <p className="mobile-menu-eyebrow">İçindekiler</p>
          <nav className="mobile-sections" aria-label="Bölümler">
            {SECTIONS.map((section, index) => (
              <NavLink
                key={section.to}
                to={section.to}
                className={sectionClass}
                onClick={onClose}
                style={{ '--item-index': index }}
              >
                <span className="mobile-section-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mobile-section-label">{section.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mobile-menu-rule" />

          {user ? (
            <>
              <p className="mobile-menu-eyebrow">Hesabım</p>

              <Link to="/create-book" className="btn btn-primary btn-medium mobile-cta" onClick={onClose}>
                <Create fontSize="small" aria-hidden="true" />
                Kitap Oluştur
              </Link>

              <NavLink to="/profile" className={itemClass} onClick={onClose}>
                <Person className="mobile-icon" aria-hidden="true" />
                <span>Profilim</span>
              </NavLink>

              {canAccessPublisherPortal(user) && (
                <NavLink to="/publisher" className={itemClass} onClick={onClose}>
                  <MenuBook className="mobile-icon" aria-hidden="true" />
                  <span>Yayınevi Portalı</span>
                </NavLink>
              )}

              <NavLink to="/messages" className={itemClass} onClick={onClose}>
                <FiMessageCircle className="mobile-icon" aria-hidden="true" />
                <span>Mesajlar</span>
                {unreadCount > 0 && (
                  <span className="mobile-nav-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>

              {/* İkon ve yazı tek <button>: satırın tamamı tıklanabilir */}
              <NotificationBell
                onNavigate={onClose}
                className="mobile-nav-item mobile-nav-item--bell"
                label="Bildirimler"
              />

              <div className="mobile-action-area">
                <Button
                  variant="ghost"
                  className="w-full mobile-logout"
                  onClick={handleLogout}
                  icon={<Logout fontSize="small" />}
                >
                  Çıkış Yap
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mobile-menu-eyebrow">Betik'e katıl</p>
              <Link to="/register" className="btn btn-primary btn-medium mobile-cta" onClick={onClose}>
                <AppRegistration fontSize="small" aria-hidden="true" />
                Kayıt Ol
              </Link>
              <Link to="/login" className="btn btn-outline btn-medium mobile-cta" onClick={onClose}>
                <Login fontSize="small" aria-hidden="true" />
                Giriş Yap
              </Link>
            </>
          )}

          <p className="mobile-menu-colophon">Yaz · Oku · Destekle · Bastır</p>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
