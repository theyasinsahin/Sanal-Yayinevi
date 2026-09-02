import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Explore,
  Create,
  Person,
  Login,
  Logout,
  AppRegistration,
  FormatQuote,
  EmojiEvents,
  Forum,
  LightMode,
  DarkMode,
  SettingsBrightness,
} from '@mui/icons-material';
import { FiMessageCircle } from 'react-icons/fi';

// --- CONTEXT & HOOKS ---
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useUnreadMessageCount } from '../../../hooks/useMessages';

// --- UI KIT IMPORTS ---
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import NotificationBell from '../../Notification/NotificationBell';

import './MobileMenu.css';

const THEME_ICONS = {
  light: <LightMode fontSize="small" />,
  dark: <DarkMode fontSize="small" />,
  system: <SettingsBrightness fontSize="small" />,
};

const THEME_LABELS = {
  light: 'Açık Tema',
  dark: 'Koyu Tema',
  system: 'Sistem Teması',
};

const MobileMenu = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Okunmamış mesaj sayısı — desktop navbar'daki ile aynı hook, sadece giriş yapılmışsa dolu gelir
  const unreadCount = useUnreadMessageCount();

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  // Çıkış yapma fonksiyonu
  const handleLogout = () => {
    logout();
    onClose();
    navigate('/'); // Çıkış yapınca ana sayfaya at
  };

  return (
    <>
      {/* 1. Arka Plan Örtüsü (Overlay) */}
      <div
        className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* 2. Menü Çekmecesi (Drawer) */}
      <div className={`mobile-menu-drawer ${isOpen ? 'open' : ''}`}>

        <div className="mobile-menu-content">

          {/* --- HERKESİN GÖRDÜĞÜ LİNKLER (desktop menüyle birebir aynı) --- */}
          <Link to="/feed" className="mobile-nav-item" onClick={onClose}>
            <Explore className="mobile-icon" />
            <Typography variant="body" weight="medium">Keşfet</Typography>
          </Link>

          <Link to="/quotes" className="mobile-nav-item" onClick={onClose}>
            <FormatQuote className="mobile-icon" />
            <Typography variant="body" weight="medium">Alıntılar</Typography>
          </Link>

          <Link to="/leaderboard" className="mobile-nav-item" onClick={onClose}>
            <EmojiEvents className="mobile-icon" />
            <Typography variant="body" weight="medium">Lider Tablosu</Typography>
          </Link>

          <Link to="/sessions" className="mobile-nav-item" onClick={onClose}>
            <Forum className="mobile-icon" />
            <Typography variant="body" weight="medium">Oturumlar</Typography>
          </Link>

          <div className="divider"></div>

          {user ? (
            // --- GİRİŞ YAPMIŞ KULLANICI MENÜSÜ ---
            <>
              <Link to="/profile" className="mobile-nav-item" onClick={onClose}>
                <Person className="mobile-icon" />
                <Typography variant="body" weight="medium">Profilim</Typography>
              </Link>

              <Link to="/create-book" className="mobile-nav-item" onClick={onClose}>
                <Create className="mobile-icon" />
                <Typography variant="body" weight="medium">Kitap Oluştur</Typography>
              </Link>

              <Link to="/messages" className="mobile-nav-item" onClick={onClose}>
                <FiMessageCircle className="mobile-icon" />
                <Typography variant="body" weight="medium">Mesajlar</Typography>
                {unreadCount > 0 && (
                  <span className="mobile-nav-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Bildirimler — artık ikon+yazı TEK bir <button> içinde
                  (NotificationBell'e "label" prop'u geçildiğinde bu
                  şekilde render ediyor), böylece satırın tamamı
                  tıklanabilir. Eskiden sadece küçük ikon tıklanabilirdi,
                  yazıya dokununca hiçbir şey açılmıyordu. Panel de zaten
                  document.body'ye portallandığı için burada, çekmecenin
                  içinde olmasının konumlandırmaya bir etkisi yok. */}
              <NotificationBell
                className="mobile-nav-item mobile-nav-item--bell"
                label="Bildirimler"
              />

              <div className="divider"></div>

              <button
                type="button"
                className="mobile-nav-item mobile-nav-item--button"
                onClick={() => setTheme(nextTheme)}
              > {/*
              {THEME_ICONS[theme]}
                <Typography variant="body" weight="medium">{THEME_LABELS[theme]}</Typography>
              */}
                
              </button>

              <div className="mobile-action-area">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLogout}
                  icon={<Logout fontSize="small" />}
                >
                  Çıkış Yap
                </Button>
              </div>
            </>
          ) : (
            // --- MİSAFİR KULLANICI MENÜSÜ ---
            <>
              <Link to="/login" className="mobile-nav-item" onClick={onClose}>
                <Login className="mobile-icon" />
                <Typography variant="body" weight="medium">Giriş Yap</Typography>
              </Link>

              <Link to="/register" className="mobile-nav-item" onClick={onClose}>
                <AppRegistration className="mobile-icon" />
                <Typography variant="body" weight="medium">Kayıt Ol</Typography>
              </Link>

              <div className="divider"></div>

              <button
                type="button"
                className="mobile-nav-item mobile-nav-item--button"
                onClick={() => setTheme(nextTheme)}
              >
                {/* 
                {THEME_ICONS[theme]}
                <Typography variant="body" weight="medium">{THEME_LABELS[theme]}</Typography>
                */}
                
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
};

export default MobileMenu;