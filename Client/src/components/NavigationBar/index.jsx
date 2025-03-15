// NavigationBar/index.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Close, Book, Person } from '@mui/icons-material';
import MobileMenu from './MobileMenu';
import './NavigationBar.css';

const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="navigation-bar">
      <div className="nav-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <Book className="logo-icon" />
          <span>Writer Wings</span>
        </Link>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          <Link to="/feed" className="nav-link">
            Keşfet
          </Link>
          <Link to="/create-book" className="nav-link highlight">
            Kitap Oluştur
          </Link>
          <Link to="/profile" className="nav-link">
            <Person className="profile-icon" />
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <Close /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </nav>
  );
};

export default NavigationBar;