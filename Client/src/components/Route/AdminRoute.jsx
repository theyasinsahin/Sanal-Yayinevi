import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Kontrol ediliyor...</div>;

  console.log("AdminRoute - Mevcut Kullanıcı:", user);
  // Kullanıcı yoksa veya Rolü ADMIN değilse Ana Sayfaya at
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;