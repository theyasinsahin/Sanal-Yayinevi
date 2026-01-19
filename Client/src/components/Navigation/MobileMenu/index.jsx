import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Explore, 
  Create, 
  Person, 
  Login, 
  Logout, 
  AppRegistration 
} from '@mui/icons-material';

// --- CONTEXT ---
import { useAuth } from '../../../context/AuthContext';

// --- UI KIT IMPORTS ---
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';

import './MobileMenu.css';

const MobileMenu = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          
          {/* --- HERKESİN GÖRDÜĞÜ LİNKLER --- */}
          <Link to="/feed" className="mobile-nav-item" onClick={onClose}>
            <Explore className="mobile-icon" />
            <Typography variant="body" weight="medium">Keşfet</Typography>
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
            </>
          )}

        </div>
      </div>
    </>
  );
};

export default MobileMenu;