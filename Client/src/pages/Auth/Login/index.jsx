import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { Email, Lock, Login as LoginIcon } from '@mui/icons-material';

// --- IMPORTS ---
import { useAuth } from '../../../context/AuthContext';
import { LOGIN } from '../../../graphql/mutations/user';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import { Container } from '../../../components/UI/Container';

// CSS Dosyası (Sadece bu sayfaya özel düzenler için)
import '../AuthPages.css';
import { MainLayout } from '../../../components/Layout/MainLayout';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [loginMutation, { loading, error }] = useMutation(LOGIN);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await loginMutation({
        variables: { ...formData }
      });

      if (data && data.login) {
        const { token, user } = data.login;
        login(token, user.id, user);
        navigate('/profile'); 
      }
    } catch (err) {
      console.error("Giriş sırasında hata oluştu:", err.message);
    }
  };

  return (
    <MainLayout>
    <div className="auth-page-wrapper">
      <Container maxWidth="lg"> {/* Küçük genişlikte ortalanmış container */}
        <div className="auth-card">
          
          {/* Başlık */}
          <div className="auth-header">
            <div className="auth-icon-circle">
              <LoginIcon fontSize="large" style={{ color: '#2563EB' }} />
            </div>
            <Typography variant="h3" weight="bold" className="text-center mb-2">
              Quill'e Giriş
            </Typography>
            <Typography variant="body" color="muted" className="text-center">
              Hesabınıza erişmek için bilgilerinizi girin
            </Typography>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div className="auth-error-box">
              <Typography variant="small" color="danger">
                {error.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin."}
              </Typography>
            </div>
          )}

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
              className="w-full" // CSS'te w-full: width: 100% tanımlayacağız
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