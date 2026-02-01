import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Person, 
  Email, 
  Lock, 
  HowToReg, 
  AlternateEmail 
} from '@mui/icons-material';

// --- GRAPHQL & UTILS ---
import { REGISTER } from '../../../graphql/mutations/user';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import { Container } from '../../../components/UI/Container';

// CSS (AuthPages.css ortak kullanılıyor)
import '../AuthPages.css';
import { MainLayout } from '../../../components/Layout/MainLayout';

const RegisterPage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
  });

  // Checkbox state'i (Form submit için gerekli olabilir)
  const [termsAccepted, setTermsAccepted] = useState(true);

  const [register, { loading, error, data }] = useMutation(REGISTER);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      alert("Lütfen kullanım koşullarını kabul edin.");
      return;
    }

    try {
      const res = await register({ variables: formData });
      
      // Kayıt başarılıysa 2 saniye sonra login'e at
      if (res.data && res.data.register) {
        setTimeout(() => {
            navigate('/login');
        }, 2000);
      }
    } catch (err) {
      console.error("Kayıt hatası:", err.message);
    }
  };

  return (
    <MainLayout>
    <div className="auth-page-wrapper">
      <Container maxWidth="lg">
        <div className="auth-card">
          
          {/* --- Header --- */}
          <div className="auth-header">
            <div className="auth-icon-circle">
              <HowToReg fontSize="large" style={{ color: '#2563EB' }} />
            </div>
            <Typography variant="h3" weight="bold" className="text-center mb-2">
              Yeni Hesap Oluştur
            </Typography>
            <Typography variant="body" color="muted" className="text-center">
              Quill ailesine katılmak için bilgilerinizi girin
            </Typography>
          </div>

          {/* --- Mesajlar (Hata / Başarı) --- */}
          {error && (
            <div className="auth-error-box">
              <Typography variant="small" color="danger">
                {error.message || "Kayıt işlemi başarısız oldu."}
              </Typography>
            </div>
          )}

          {data && (
            <div className="auth-success-box">
              <Typography variant="body" className="success-text">
                🎉 Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...
              </Typography>
            </div>
          )}

          {/* --- Form --- */}
          <form onSubmit={handleSubmit} className="auth-form">
            
            {/* İki input yan yana (Ad Soyad - Kullanıcı Adı) */}
            <div className="form-row">
              <Input
                label="Tam Adınız"
                name="fullName"
                placeholder="Ad Soyad"
                value={formData.fullName}
                onChange={handleChange}
                icon={<Person fontSize="small" />}
                required
                disabled={loading}
              />
              
              <Input
                label="Kullanıcı Adı"
                name="username"
                placeholder="kullaniciadi"
                value={formData.username}
                onChange={handleChange}
                icon={<AlternateEmail fontSize="small" />}
                required
                disabled={loading}
              />
            </div>

            <Input
              label="E-Posta"
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

            {/* Terms Checkbox (Özel UI Input olmadığı için HTML+CSS kullanıyoruz) */}
            <div className="terms-wrapper">
              <input 
                type="checkbox" 
                id="terms" 
                className="terms-checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required 
              />
              <label htmlFor="terms" className="terms-label">
                <Link to="/kullanim-kosullari" className="link">Kullanım Koşulları</Link>'nı okudum ve kabul ediyorum.
              </label>
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              size="large" 
              isLoading={loading}
              className="w-full"
            >
              Kayıt Ol
            </Button>

            <div className="auth-footer">
              <Typography variant="body" color="muted">
                Zaten hesabın var mı?{' '}
                <Link to="/login" className="register-link">
                  Giriş Yap
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

export default RegisterPage;