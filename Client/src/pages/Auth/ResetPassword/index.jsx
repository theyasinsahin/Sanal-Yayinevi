// src/pages/Auth/ResetPassword/index.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock } from '@mui/icons-material';
import { RESET_PASSWORD_MUTATION } from '../../../graphql/mutations/user';
import { MainLayout } from '../../../components/Layout/MainLayout';
import { Container } from '../../../components/UI/Container';
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import '../AuthPages.css';

import PasswordStrengthIndicator from '../../../components/UI/PasswordStrengthIndicator';
import { validatePassword } from '../../../utils/PasswordValidation';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD_MUTATION);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { isValid } = validatePassword(newPassword);
    if (!isValid) {
        setError('Şifreniz gereken koşulları sağlamıyor.');
        return;
    }
    if (newPassword !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    try {
      await resetPassword({ variables: { token, newPassword } });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <MainLayout>
      <div className="auth-page-wrapper">
        <Container maxWidth="lg">
          <div className="auth-card">
            <div className="auth-header">
              <Typography variant="h3" weight="bold" className="text-center mb-2">
                Yeni Şifre Belirle
              </Typography>
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Typography variant="body">
                  Şifreniz güncellendi! Giriş sayfasına yönlendiriliyorsunuz...
                </Typography>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                {error && (
                  <div className="auth-error-box">
                    <Typography variant="small" color="danger">{error}</Typography>
                  </div>
                )}
                <Input
                  label="Yeni Şifre"
                  name="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<Lock fontSize="small" />}
                  required
                />
                <Input
                  label="Şifre Tekrar"
                  name="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  icon={<Lock fontSize="small" />}
                  required
                />
                <PasswordStrengthIndicator password={newPassword} />

                <Button type="submit" variant="primary" size="large" isLoading={loading} className="w-full">
                  Şifremi Güncelle
                </Button>
              </form>
            )}
          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default ResetPasswordPage;