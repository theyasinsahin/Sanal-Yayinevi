import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Person, 
  Email, 
  Lock, 
  HowToReg, 
  AlternateEmail,
  VpnKey 
} from '@mui/icons-material';

// --- GRAPHQL & UTILS ---
import { REGISTER, SEND_REGISTRATION_CODE } from '../../../graphql/mutations/user';

import PasswordStrengthIndicator from '../../../components/UI/PasswordStrengthIndicator';
import { validatePassword } from '../../../utils/PasswordValidation';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Input } from '../../../components/UI/Input';
import { Container } from '../../../components/UI/Container';
import { GoogleLogin } from '@react-oauth/google';

import '../AuthPages.css';
import { MainLayout } from '../../../components/Layout/MainLayout';

// Google'ın redirect ux_mode'unda credential'ı POST edeceği backend endpoint'i.
// Bu domain, Google Cloud Console'daki OAuth Client ID'nin
// "Authorized JavaScript origins" listesinde olmalı.
const GOOGLE_LOGIN_URI = 'https://sanal-yayinevi.onrender.com/auth/google/callback';

const RegisterPage = () => {
  const navigate = useNavigate();
  
  // --- STATE'LER ---
  const [step, setStep] = useState(1); // 1: Form, 2: Doğrulama
  const [verificationCode, setVerificationCode] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Backend'den dönen özel { code, message } yanıtlarını tutmak için
  const [customError, setCustomError] = useState('');
  const [customSuccess, setCustomSuccess] = useState('');

  // --- MUTATION'LAR ---
  const [sendCode, { loading: codeLoading, error: codeError }] = useMutation(SEND_REGISTRATION_CODE);
  const [register, { loading: regLoading, error: regError }] = useMutation(REGISTER);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 1. ADIM: E-posta Gönderme
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setCustomError(''); // Yeni istek öncesi eski hataları temizle

    if (!termsAccepted) return alert("Lütfen kullanım koşullarını kabul edin.");

    // Şifre validasyonu
    const { isValid } = validatePassword(formData.password);
    if (!isValid) {
      setCustomError("Şifreniz gereken koşulları sağlamıyor.");
      return;
    }

    try {
      const res = await sendCode({ 
        variables: { email: formData.email, username: formData.username } 
      });
      
      const result = res.data.sendRegistrationCode;

      // Backend 200 (başarılı) döndüyse 2. adıma geç
      if (result.code === 200) {
        setStep(2); 
      } else {
        // Backend 400 (hata) döndüyse mesajı ekrana yazdır
        setCustomError(result.message);
      }
    } catch (err) {
      // GraphQL isteği hiç gidemezse (örn. internet kopukluğu)
      setCustomError("Sunucuya ulaşılamıyor: " + err.message);
    }
  };

  // 2. ADIM: Kod Onayı ve Gerçek Kayıt
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setCustomError('');

    try {
      const res = await register({ 
        variables: { ...formData, code: verificationCode } 
      });
      
      const result = res.data.register;

      if (result.code === 200) {
        // Kayıt başarılıysa başarı mesajını göster ve giriş sayfasına at
        setCustomSuccess(result.message);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        // Geçersiz kod vb. durumlarda hatayı ekrana bas
        setCustomError(result.message);
      }
    } catch (err) {
      setCustomError("Sunucuya ulaşılamıyor: " + err.message);
    }
  };

  return (
    <MainLayout>
      <div className="auth-page-wrapper">
        <Container maxWidth="lg">
          <div className="auth-card">
            
            <div className="auth-header">
              <div className="auth-icon-circle">
                <HowToReg fontSize="large" style={{ color: '#8b4513' }} />
              </div>
              <Typography variant="h3" weight="bold" className="text-center mb-2">
                {step === 1 ? "Yeni Hesap Oluştur" : "E-postanı Doğrula"}
              </Typography>
              <Typography variant="body" color="muted" className="text-center">
                {step === 1 
                  ? "Betik ailesine katılmak için bilgilerinizi girin" 
                  : `${formData.email} adresine gönderilen kodu girin.`}
              </Typography>
            </div>

            {/* HATA MESAJLARI (Backend Custom Error VEYA GraphQL Network Error) */}
            {(codeError || regError || customError) && (
              <div className="auth-error-box">
                <Typography variant="small" color="danger">
                  {customError || codeError?.message || regError?.message || "Bir sorun oluştu."}
                </Typography>
              </div>
            )}

            {/* BAŞARI MESAJI */}
            {customSuccess && (
              <div className="auth-success-box">
                <Typography variant="body" className="success-text">
                  🎉 {customSuccess} Yönlendiriliyorsunuz...
                </Typography>
              </div>
            )}

            {/* --- ADIM 1: KAYIT FORMU --- */}
            {step === 1 && (
              <form onSubmit={handleRegisterSubmit} className="auth-form">
                {/* DÜZELTME: Google butonu ve "VEYA E-POSTA İLE" ayırıcısı
                    önceden yanlışlıkla .form-row (2 sütunlu grid) içindeydi.
                    Bu yüzden CSS Grid onları da otomatik olarak sütunlara
                    yerleştiriyordu: 1. satır [Google | Ayırıcı],
                    2. satır [Tam Adınız | Kullanıcı Adı]. Ayırıcı metni
                    2 satıra sarınca o satırın yüksekliği değişiyor ve
                    Tam Adınız / Kullanıcı Adı farklı hizalarda başlıyordu.
                    Artık form-row SADECE gerçekten yan yana olması gereken
                    iki input'u sarmalıyor; Google butonu ve ayırıcı kendi
                    tam genişlikte satırlarında. */}
                <div className="google-auth-wrapper mb-4">
                  {/* ux_mode="redirect": popup + postMessage yerine gerçek sayfa
                      yönlendirmesi kullanır (COOP sorununu tamamen ortadan
                      kaldırır). useOneTap kaldırıldı — o da iframe/postMessage
                      tabanlı olduğu için aynı türde sorunlara açıktı. */}
                  <GoogleLogin
                      ux_mode="redirect"
                      login_uri={GOOGLE_LOGIN_URI}
                      onError={() => setCustomError("Google penceresi açılamadı veya iptal edildi.")}
                  />
                </div>

                <div className="auth-divider">
                    <span className="divider-text">VEYA E-POSTA İLE</span>
                </div>

                <div className="form-row">
                  <Input 
                    label="Tam Adınız" 
                    name="fullName" 
                    value={formData.fullName} 
                    onChange={handleChange} 
                    icon={<Person fontSize="small" />} 
                    required 
                    disabled={codeLoading} 
                  />
                  <Input 
                    label="Kullanıcı Adı" 
                    name="username" 
                    value={formData.username} 
                    onChange={handleChange} 
                    icon={<AlternateEmail fontSize="small" />} 
                    required 
                    disabled={codeLoading} 
                  />
                </div>
                <Input 
                  label="E-Posta" 
                  name="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  icon={<Email fontSize="small" />} 
                  required 
                  disabled={codeLoading} 
                />
                <Input 
                  label="Şifre" 
                  name="password" 
                  type="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  icon={<Lock fontSize="small" />} 
                  required 
                  disabled={codeLoading} 
                />
                <PasswordStrengthIndicator password={formData.password} />
                
                <div className="terms-wrapper">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    checked={termsAccepted} 
                    onChange={(e) => setTermsAccepted(e.target.checked)} 
                    required 
                  />
                  <label htmlFor="terms" className="terms-label">
                    <Link to="/kullanim-kosullari" className="link">Kullanım Koşulları</Link>'nı kabul ediyorum.
                  </label>
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  size="large" 
                  isLoading={codeLoading} 
                  className="w-full"
                >
                  Doğrulama Kodu Gönder
                </Button>
              </form>
            )}

            {/* --- ADIM 2: KOD ONAY FORMU --- */}
            {step === 2 && (
              <form onSubmit={handleVerifySubmit} className="auth-form">
                <Input
                  label="Doğrulama Kodu"
                  name="code"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  icon={<VpnKey fontSize="small" />}
                  required
                  disabled={regLoading || customSuccess !== ''} // Başarıdan sonra formu kilitle
                />
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="large" 
                  isLoading={regLoading} 
                  className="w-full"
                  disabled={customSuccess !== ''}
                >
                  Kayıt İşlemini Tamamla
                </Button>
                <Button 
                  variant="text" 
                  onClick={() => {
                    setStep(1);
                    setCustomError(''); // Geri dönerken hataları temizle
                  }} 
                  className="w-full mt-2" 
                  disabled={regLoading || customSuccess !== ''}
                >
                  Bilgileri Düzenle
                </Button>
              </form>
            )}

            <div className="auth-footer">
              <Typography variant="body" color="muted">
                Zaten hesabın var mı? <Link to="/login" className="register-link">Giriş Yap</Link>
              </Typography>
            </div>
          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default RegisterPage;