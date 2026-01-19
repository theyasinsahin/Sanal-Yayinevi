import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Close, Person } from '@mui/icons-material';
import { FiFeather } from 'react-icons/fi';

// --- BİLEŞENLER & HOOKS ---
import MobileMenu from '../MobileMenu'; // Bir sonraki adımda düzenleyeceğiz
import { useAuth } from '../../../context/AuthContext';

// --- UI KIT ---
import { Container } from '../../UI/Container';
import { Button } from '../../UI/Button';
import { Typography } from '../../UI/Typography';

import './NavigationBar.css';

const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth(); 

  return (
    <nav className="navigation-bar">
      {/* İçeriği diğer sayfalarla hizalamak için Container kullanıyoruz */}
      <Container maxWidth="7xl" className="h-full">
        <div className="nav-content">
          
          {/* --- LOGO --- */}
          <Link to="/" className="nav-logo">
            <FiFeather className="logo-icon" />
            <Typography variant="h4" weight="bold" className="logo-text">
              Quill
            </Typography>
          </Link>

          {/* --- DESKTOP MENU --- */}
          <div className="desktop-menu">
            {/* Normal Link */}
            <Link to="/feed" className="nav-item">
              <Typography variant="body" weight="medium">Keşfet</Typography>
            </Link>
            
            {/* KULLANICI KONTROLÜ */}
            {user ? (
              <>
                {/* Kitap Oluştur Butonu */}
                <Link to="/create-book" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="small">
                    Kitap Oluştur
                  </Button>
                </Link>
                
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

          {/* --- MOBILE TOGGLE --- */}
          <button 
            className="mobile-toggle-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menüyü Aç/Kapat"
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