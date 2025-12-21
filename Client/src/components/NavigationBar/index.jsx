// NavigationBar/index.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Close, Quill, Person } from '@mui/icons-material';
import { FiFeather } from 'react-icons/fi';
import MobileMenu from './MobileMenu';
import './NavigationBar.css';
import { ME_QUERY } from './graphql';
import { useQuery } from '@apollo/client';
import { useEffect } from 'react';
const NavigationBar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { data, loading, error } = useQuery(ME_QUERY);
  

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
          {/* If user is logged in, show create book link */}
          {data && data.me ? (
          <Link to="/create-book" className="nav-link highlight">
            Kitap Oluştur
          </Link>
          ) : null}
          { /*If user logged in*/
          data ? (
            <Link to="/profile" className="nav-link">
              <Person className="profile-icon" />
            </Link>) : (
            <Link to="/login" className="nav-link">
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

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </nav>
  );
};

export default NavigationBar;