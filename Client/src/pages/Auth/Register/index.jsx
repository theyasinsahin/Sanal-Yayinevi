import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Person, Email, Lock, HowToReg, AlternateEmail } from '@mui/icons-material';
import '../AuthPages.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    username:'',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Kayıt işlemleri
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
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="input-group">
            <label><AlternateEmail /> Kullanıcı Adınız</label>
            <input
              type="text"
              name="name"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>

          <div className="input-group">
            <label><Email /> E-Posta</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="input-group">
            <label><Lock /> Şifre</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="input-group">
            <label><Lock /> Şifre Tekrar</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
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
            Kayıt Ol
          </button>

          <div className="auth-footer">
            Zaten hesabın var mı? <Link to="/login" className="link">Giriş Yap</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;