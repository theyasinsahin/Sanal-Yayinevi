import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Email, Lock, Login } from '@mui/icons-material';
import '../AuthPages.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Giriş işlemleri
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">
          <Login fontSize="large" /> Writer Wings'e Giriş
        </h1>

        <form onSubmit={handleSubmit}>
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

          <div className="auth-options">
            <Link to="/sifremi-unuttum" className="link">Şifremi Unuttum</Link>
          </div>

          <button type="submit" className="auth-button">
            Giriş Yap
          </button>

          <div className="auth-footer">
            Hesabın yok mu? <Link to="/register" className="link">Kayıt Ol</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;