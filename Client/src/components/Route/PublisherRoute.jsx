import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessPublisherPortal } from '../../utils/publisher';

export default function PublisherRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Yetkiler kontrol ediliyor…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessPublisherPortal(user)) return <Navigate to="/" replace />;
  return children;
}
