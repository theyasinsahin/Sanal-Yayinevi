// NavigationBar/MobileMenu.js
import React from 'react';
import { Link } from 'react-router-dom';

const MobileMenu = ({ isOpen, onClose }) => {
  return (
    <div className={`mobile-menu-wrapper ${isOpen ? 'open' : ''}`}>
      <div className="mobile-menu-overlay" onClick={onClose} />
      <div className="mobile-menu">
        <Link to="/kesfet" className="mobile-link" onClick={onClose}>
          Keşfet
        </Link>
        <Link to="/create-book" className="mobile-link highlight" onClick={onClose}>
          Kitap Oluştur
        </Link>
        <Link to="/profil" className="mobile-link" onClick={onClose}>
          Profilim
        </Link>
      </div>
    </div>
  );
};

export default MobileMenu;