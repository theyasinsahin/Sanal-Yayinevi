import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Email, Lock, Login as LoginIcon } from '@mui/icons-material';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_LOGIN_ENABLED } from '../../../config/integrations';

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

import { GOOGLE_LOGIN_URI } from '../../../config/api';
import { googleLoginNonce } from '../../../utils/googleLoginNonce';
import { authReturnTo, finishRegistrationIntent, registrationUrl, rememberAuthReturnTo } from '../../../utils/registrationIntent';

const LoginPage = () => {
  const [googleNonce] = useState(googleLoginNonce);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  useEffect(() => { rememberAuthReturnTo(`?${searchParams}`); }, [searchParams]);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      navigate(finishRegistrationIntent({ userId: user.id, search: `?${searchParams}` }), { replace: true });
    }
  }, [user, navigate, searchParams]);

  const [customError, setCustomError] = useState('');

  // Google redirect akışı bizi ?error=... ile buraya geri gönderebilir
  // (örn. callback'te doğrulama başarısız oldu). URL'deki hatayı okuyup göster.
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'google_auth_failed') {
      setCustomError('Google ile giriş yapılamadı. Lütfen tekrar deneyin.');
    } else if (err === 'google_csrf_failed') {
      setCustomError('Google oturum doğrulaması yenilendi. Lütfen tekrar deneyin.');
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
              <LoginIcon fontSize="large" />
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
            <div className="ui-notice ui-notice--error" role="alert">
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
          {GOOGLE_LOGIN_ENABLED && <div className="google-auth-wrapper">
            {googleNonce ? <GoogleLogin locale="tr"
              nonce={googleNonce}
              ux_mode="redirect"
              login_uri={GOOGLE_LOGIN_URI}
              onError={() => setCustomError("Google penceresi açılamadı veya iptal edildi.")}
            /> : <p role="status">Tarayıcı oturum depolaması kapalı. E-posta ile devam edebilirsiniz.</p>}
          </div>}

          {/* AYIRICI ÇİZGİ */}
          {GOOGLE_LOGIN_ENABLED && <div className="auth-divider">
            <span className="divider-text">VEYA E-POSTA İLE</span>
          </div>}

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
              <Link to={`/sifremi-unuttum?returnTo=${encodeURIComponent(authReturnTo(`?${searchParams}`))}`} className="ui-text-link">
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
                <Link to={registrationUrl('register', { returnTo: authReturnTo(`?${searchParams}`) })} className="ui-text-link">
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
