import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Email, Lock, Login } from '@mui/icons-material';
import '../AuthPages.css';

import { useMutation } from '@apollo/client';
import { LOGIN } from '../../../graphql/mutations/user';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [login, { loading, error, data }] = useMutation(LOGIN);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    login({ variables: formData })
      .then(res => {
        localStorage.setItem("token", res.data.login.token);
        localStorage.setItem('userId', res.data.login.user.id);
        // yönlendirme veya mesaj gösterme
        window.location.href = "/";
      })
      .catch(err => {
        console.error("Giriş hatası:", err.message);
      }
    );
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