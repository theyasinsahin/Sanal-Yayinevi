import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Dashboard, People, LibraryBooks, Receipt, Logout, Home } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { Typography } from '../UI/Typography';
import './AdminLayout.css';

const AdminLayout = ({ children, title, className = '' }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`admin-wrapper ${className}`}>
      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Typography variant="h5" weight="bold" color="white">Betik Yönetim</Typography>
        </div>
        
        <nav className="admin-nav">
          <NavLink to="/admin/print-funding" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Basım, Destek ve Ön Sipariş
          </NavLink>
          <NavLink to="/admin" end className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <Dashboard fontSize="small" /> Yönetim Paneli
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <People fontSize="small" /> Kullanıcılar
          </NavLink>
          <NavLink to="/admin/books" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Kitaplar
          </NavLink>
          <NavLink to="/admin/genres" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Kitap Türleri
          </NavLink>
          <NavLink to="/admin/data" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Bütün Veriler
          </NavLink>
          <NavLink to="/admin/schemas" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Şemalar ve Alanlar
          </NavLink>
          <NavLink to="/admin/transactions" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <Receipt fontSize="small" /> Finans
          </NavLink>
          <NavLink to="/admin/session-access" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <People fontSize="small" /> Oturum İzinleri
          </NavLink>
          <NavLink to="/admin/printed-books" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Basılı Kitaplar ve Hak Talepleri
          </NavLink>
        </nav>

        <div className="admin-bottom-actions">
          <button onClick={() => navigate('/feed')} className="admin-link">
             <Home fontSize="small"/> Siteye Dön
          </button>
          <button onClick={handleLogout} className="admin-link logout">
             <Logout fontSize="small"/> Çıkış
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-content">
        <header className="admin-header">
          <Typography variant="h4" weight="bold">{title}</Typography>
        </header>
        <div className="admin-page-body">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
