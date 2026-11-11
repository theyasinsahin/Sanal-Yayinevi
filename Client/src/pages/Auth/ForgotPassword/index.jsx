import { authReturnTo, registrationUrl } from '../../../utils/registrationIntent';
// src/pages/Auth/ForgotPassword/index.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link, useLocation } from 'react-router-dom';
import { Email } from '@mui/icons-material';
import { FORGOT_PASSWORD_MUTATION } from '../../../graphql/mutations/user';
import { MainLayout } from '../../../components/Layout/MainLayout';
import { Container } from '../../../components/UI/Container';
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import '../AuthPages.css';

const ForgotPasswordPage = () => {
  const { search } = useLocation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [forgotPassword, { loading, error }] = useMutation(FORGOT_PASSWORD_MUTATION);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      const { data } = await forgotPassword({ variables: { email: email.trim() } });
      if (data?.forgotPassword?.code !== 200) throw new Error(data?.forgotPassword?.message || 'İstek tamamlanamadı.');
      setSent(true);
    } catch (err) {
      setSubmitError('Bağlantı gönderilemedi. Lütfen biraz sonra tekrar deneyin.');
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

            {(error || submitError) && !sent && (
              <div className="ui-notice ui-notice--error" role="alert">
                Bağlantı gönderilemedi. Lütfen biraz sonra tekrar deneyin.
              </div>
            )}

            {sent ? (
              <div className="auth-result">
                <Typography variant="body" className="ui-notice ui-notice--success" role="status">
                  E-postanızı kontrol edin. Kayıtlı bir hesabınız varsa sıfırlama isteğiniz alındı. Bağlantı <b>1 saat</b> geçerlidir.
                </Typography>
                <p>Spam klasörünü de kontrol edin. E-posta ulaşmadıysa biraz sonra yeniden deneyebilirsiniz.</p>
                <Button type="button" variant="outline" onClick={() => setSent(false)}>Yeniden dene</Button>
                <Link to={registrationUrl('login', { returnTo: authReturnTo(search) })} className="ui-text-link">
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
                  disabled={loading}
                />
                <Button type="submit" variant="primary" size="large" isLoading={loading} className="w-full">
                  Sıfırlama Bağlantısı Gönder
                </Button>
                <div className="auth-footer">
                  <Link to={registrationUrl('login', { returnTo: authReturnTo(search) })} className="ui-text-link">Giriş sayfasına dön</Link>
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
