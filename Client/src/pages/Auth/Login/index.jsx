import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Email, Lock, Login as LoginIcon } from '@mui/icons-material';
import { GoogleLogin } from '@react-oauth/google';

// --- IMPORTS ---
import { useAuth } from '../../../context/AuthContext';
import { LOGIN } from '../../../graphql/mutations/user';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import { Container } from '../../../components/UI/Container';

// CSS Dosyası
import '../AuthPages.css';
import { MainLayout } from '../../../components/Layout/MainLayout';

// Google'ın redirect ux_mode'unda credential'ı POST edeceği backend endpoint'i.
// Bu domain, Google Cloud Console'daki OAuth Client ID'nin
// "Authorized JavaScript origins" listesinde olmalı.
const GOOGLE_LOGIN_URI = 'http://localhost:5000/auth/google/callback';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user]);

  const [customError, setCustomError] = useState('');

  // Google redirect akışı bizi ?error=... ile buraya geri gönderebilir
  // (örn. callback'te doğrulama başarısız oldu). URL'deki hatayı okuyup göster.
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'google_auth_failed') {
      setCustomError('Google ile giriş yapılamadı. Lütfen tekrar deneyin.');
    } else if (err === 'account_deleted') {
      setCustomError('Bu e-posta adresine ait hesap silinmiş.');
    } else if (err === 'google_no_credential') {
      setCustomError('Google\'dan giriş bilgisi alınamadı. Lütfen tekrar deneyin.');
    }
  }, [searchParams]);

  const [loginMutation, { loading, error }] = useMutation(LOGIN);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCustomError('');
    try {
      const { data } = await loginMutation({ variables: { ...formData } });
      if (data?.login) {
        const { token, user } = data.login;
        login(token, user.id, user); // navigate yok
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <MainLayout>
    <div className="auth-page-wrapper">
      <Container maxWidth="lg">
        <div className="auth-card">
          
          {/* Başlık */}
          <div className="auth-header">
            <div className="auth-icon-circle">
              <LoginIcon fontSize="large" style={{ color: '#8b4513' }} />
            </div>
            <Typography variant="h3" weight="bold" className="text-center mb-2">
              Betik'e Giriş
            </Typography>
            <Typography variant="body" color="muted" className="text-center">
              Hesabınıza erişmek için bilgilerinizi girin
            </Typography>
          </div>

          {/* Hata Mesajları (Standart veya Google hatası) */}
          {(error || customError) && (
            <div className="auth-error-box">
              <Typography variant="small" color="danger">
                {customError || (error?.message === "Failed to fetch" ? "Geçici bir sorun yaşanıyor olabilir. Lütfen biraz sonra tekrar deneyin." : "Giriş yapılamadı. Bilgilerinizi kontrol edin.")}
              </Typography>
            </div>
          )}

          {/* --- GOOGLE GİRİŞ BUTONU ---
              ux_mode="redirect": popup + postMessage yerine gerçek sayfa
              yönlendirmesi kullanır. Google credential'ı GOOGLE_LOGIN_URI'ye
              form-POST eder, backend doğrulayıp bizi /auth/callback'e
              token ile geri yönlendirir. Bu akışta onSuccess ÇAĞRILMAZ —
              sonuç URL üzerinden GoogleCallback sayfasında işlenir. */}
          <div className="google-auth-wrapper">
            <GoogleLogin
              ux_mode="redirect"
              login_uri={GOOGLE_LOGIN_URI}
              onError={() => setCustomError("Google penceresi açılamadı veya iptal edildi.")}
            />
          </div>

          {/* AYIRICI ÇİZGİ */}
          <div className="auth-divider" style={{ textAlign: 'center', margin: '1rem 0', position: 'relative' }}>
            <Typography variant="small" color="muted" style={{ background: '#fff', padding: '0 10px', position: 'relative', zIndex: 1 }}>
              VEYA E-POSTA İLE
            </Typography>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid #eee', zIndex: 0 }}></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="E-Posta Adresi"
              name="email"
              type="email"
              placeholder="ornek@email.com"
              value={formData.email}
              onChange={handleChange}
              icon={<Email fontSize="small" />}
              required
              disabled={loading}
            />

            <Input
              label="Şifre"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              icon={<Lock fontSize="small" />}
              required
              disabled={loading}
            />

            <div className="auth-options">
              <Link to="/sifremi-unuttum" className="forgot-password-link">
                Şifremi Unuttum
              </Link>
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              size="large" 
              isLoading={loading}
              className="w-full"
            >
              Giriş Yap
            </Button>

            <div className="auth-footer">
              <Typography variant="body" color="muted">
                Hesabın yok mu?{' '}
                <Link to="/register" className="register-link">
                  Kayıt Ol
                </Link>
              </Typography>
            </div>
          </form>
        </div>
      </Container>
    </div>
    </MainLayout>
  );
};

export default LoginPage;