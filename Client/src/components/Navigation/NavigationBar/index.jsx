import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Close, Person } from '@mui/icons-material'; // Quill kullanılmıyordu, kaldırdım
import { FiFeather } from 'react-icons/fi';
import MobileMenu from '../MobileMenu';
import './NavigationBar.css';

// 1. QUERY YERİNE CONTEXT IMPORT EDİYORUZ
import { useAuth } from '../../../context/AuthContext';

const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 2. AuthContext'ten user bilgisini çekiyoruz
  // user varsa giriş yapmıştır, null ise yapmamıştır.
  const { user } = useAuth(); 

  return (
    <nav className="navigation-bar">
      <div className="nav-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <FiFeather className="logo-icon" />
          <span>Quill</span>
        </Link>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          <Link to="/feed" className="nav-link">
            Keşfet
          </Link>
          
          {/* KULLANICI KONTROLÜ */}
          {user ? (
            // --- GİRİŞ YAPMIŞSA ---
            <>
              <Link to="/create-book" className="nav-link highlight">
                Kitap Oluştur
              </Link>
              
              <Link to="/profile" className="nav-link profile-btn" title="Profilim">
                <Person className="profile-icon" />
              </Link>
            </>
          ) : (
            // --- GİRİŞ YAPMAMIŞSA ---
            <Link to="/login" className="nav-link login-btn">
              Giriş Yap
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <Close /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu'ye de user bilgisini (veya istersen logout fonksiyonunu) geçebilirsin */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        user={user} // Mobile menü içinde de kontrol yapmak istersen
      />
    </nav>
  );
};

export default NavigationBar;