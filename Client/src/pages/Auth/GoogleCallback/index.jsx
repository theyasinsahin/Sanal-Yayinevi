// src/pages/Auth/GoogleCallback/index.jsx
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Typography } from '../../../components/UI/Typography';
import { MainLayout } from '../../../components/Layout/MainLayout';

// Backend (/auth/google/callback) doğrulamayı bitirdikten sonra bizi
// buraya ?token=...&user=... ile yönlendirir. Bu sayfanın tek işi:
// URL'deki bilgiyi oku, AuthContext.login() ile mevcut auth akışına
// (localStorage + user state) aktar, sonra temiz bir sayfaya geç.
const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const handled = useRef(false); // StrictMode / çift render'da iki kez çalışmasın

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (!token || !userParam) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    try {
      // URLSearchParams zaten decode ediyor, ekstra decodeURIComponent gerekmiyor
      const userData = JSON.parse(userParam);
      login(token, userData.id, userData);
      navigate('/profile', { replace: true });
    } catch (err) {
      console.error('Google callback parse hatası:', err);
      navigate('/login?error=google_auth_failed', { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <MainLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <Typography variant="body" color="muted">Google ile giriş yapılıyor...</Typography>
      </div>
    </MainLayout>
  );
};

export default GoogleCallback;