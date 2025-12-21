import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Person, Email, Lock, HowToReg, AlternateEmail } from '@mui/icons-material';
import '../AuthPages.css';

import { useMutation } from '@apollo/client';
import { REGISTER } from '../../../graphql/mutations/user';
const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    fullName:'',
    email: '',
    password: '',
  });

  const [register, { loading, error, data }] = useMutation(REGISTER);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await register({ variables: formData });
      
      // yönlendirme veya mesaj gösterme
    } catch (err) {
      console.error("Kayıt hatası:", err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">
          <HowToReg fontSize="large" /> Yeni Hesap Oluştur
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label><Person /> Tam Adınız</label>
            <input
              type="text"
              name="fullName"
              value={formData.name}
              onChange={(e) => handleChange(e)}
              required
            />
          </div>

          <div className="input-group">
            <label><AlternateEmail /> Kullanıcı Adınız</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={(e) => handleChange(e)}
              required
            />
          </div>

          <div className="input-group">
            <label><Email /> E-Posta</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => handleChange(e)}
              required
            />
          </div>

          <div className="input-group">
            <label><Lock /> Şifre</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={(e) => handleChange(e)}
              required
            />
          </div>

          <div className="terms">
            <input type="checkbox" id="terms" required />
            <label htmlFor="terms">
              <Link to="/kullanim-kosullari" className="link">Kullanım Koşulları</Link>'nı kabul ediyorum
            </label>
          </div>

          <button type="submit" className="auth-button">
            {loading ? 'Kayıt Oluşturuluyor...' : 'Kayıt Ol'}
          </button>

          {error && <p style={{ color: 'red' }}>Hata: {error.message}</p>}
          {data && <p style={{ color: 'green' }}>Kayıt başarılı: {data.register.username}</p>}

          <div className="auth-footer">
            Zaten hesabın var mı? <Link to="/login" className="link">Giriş Yap</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;