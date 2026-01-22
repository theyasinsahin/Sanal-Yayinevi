import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Dashboard, People, LibraryBooks, Receipt, Logout, Home } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { Typography } from '../UI/Typography';
import { Toast } from '../UI/Toast'; // Global toast kullanabiliriz
import './AdminLayout.css';

const AdminLayout = ({ children, title }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-wrapper">
      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Typography variant="h5" weight="bold" color="white">Quill Admin</Typography>
        </div>
        
        <nav className="admin-nav">
          <NavLink to="/admin" end className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <Dashboard fontSize="small" /> Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <People fontSize="small" /> Kullanıcılar
          </NavLink>
          <NavLink to="/admin/books" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <LibraryBooks fontSize="small" /> Kitaplar
          </NavLink>
          <NavLink to="/admin/transactions" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <Receipt fontSize="small" /> Finans
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