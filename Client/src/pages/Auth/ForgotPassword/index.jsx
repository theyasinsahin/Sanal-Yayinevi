// src/pages/Auth/ForgotPassword/index.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Email } from '@mui/icons-material';
import { FORGOT_PASSWORD_MUTATION } from '../../../graphql/mutations/user';
import { MainLayout } from '../../../components/Layout/MainLayout';
import { Container } from '../../../components/UI/Container';
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import '../AuthPages.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [forgotPassword, { loading }] = useMutation(FORGOT_PASSWORD_MUTATION);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await forgotPassword({ variables: { email } });
      setSent(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <MainLayout>
      <div className="auth-page-wrapper">
        <Container maxWidth="lg">
          <div className="auth-card">
            <div className="auth-header">
              <Typography variant="h3" weight="bold" className="text-center mb-2">
                Şifremi Unuttum
              </Typography>
              <Typography variant="body" color="muted" className="text-center">
                E-posta adresinize sıfırlama bağlantısı göndereceğiz.
              </Typography>
            </div>

            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Typography variant="body">
                  E-postanızı kontrol edin. Bağlantı <b>1 saat</b> geçerlidir.
                </Typography>
                <Link to="/login" style={{ display: 'block', marginTop: '16px', color: '#2563EB' }}>
                  Giriş sayfasına dön
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <Input
                  label="E-Posta Adresi"
                  name="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Email fontSize="small" />}
                  required
                />
                <Button type="submit" variant="primary" size="large" isLoading={loading} className="w-full">
                  Sıfırlama Bağlantısı Gönder
                </Button>
                <div className="auth-footer">
                  <Link to="/login" style={{ color: '#2563EB' }}>Giriş sayfasına dön</Link>
                </div>
              </form>
            )}
          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default ForgotPasswordPage;