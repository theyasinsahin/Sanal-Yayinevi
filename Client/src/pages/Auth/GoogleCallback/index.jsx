// src/pages/Auth/GoogleCallback/index.jsx
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { consumeGoogleLoginNonce } from '../../../utils/googleLoginNonce';
import { useAuth } from '../../../context/AuthContext';
import { Typography } from '../../../components/UI/Typography';
import { MainLayout } from '../../../components/Layout/MainLayout';

// Backend (/auth/google/callback) doğrulamayı bitirdikten sonra bizi
// buraya ?token=...&user=... ile yönlendirir. Bu sayfanın tek işi:
// URL'deki bilgiyi oku, AuthContext.login() ile mevcut auth akışına
// (localStorage + user state) aktar, sonra temiz bir sayfaya geç.
const GoogleCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const handled = useRef(false); // StrictMode / çift render'da iki kez çalışmasın

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const searchParams = new URLSearchParams(location.hash.slice(1));
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    // Bind the verified Google nonce to the initiating tab; arbitrary callback
    // links cannot sign a victim into an attacker's account.
    const validNonce = consumeGoogleLoginNonce(searchParams.get('nonce'));
    window.history.replaceState(null, '', window.location.pathname);
    if (!token || !userParam || !validNonce) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    try {
      // URLSearchParams zaten decode ediyor, ekstra decodeURIComponent gerekmiyor
      const userData = JSON.parse(userParam);
      if (typeof userData.id !== 'string' || !userData.id) throw new Error('Invalid session');
      login(token, userData.id, userData);
      navigate('/profile', { replace: true });
    } catch (err) {
      console.error('Google giriş yanıtı işlenemedi.');
      navigate('/login?error=google_auth_failed', { replace: true });
    }
  }, [location.hash, login, navigate]);

  return (
    <MainLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <Typography variant="body" color="muted">Google ile giriş yapılıyor...</Typography>
      </div>
    </MainLayout>
  );
};

export default GoogleCallback;
