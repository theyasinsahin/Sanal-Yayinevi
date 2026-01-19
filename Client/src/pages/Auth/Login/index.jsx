import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { Email, Lock, Login as LoginIcon } from '@mui/icons-material';

// 1. AuthContext'i import ediyoruz (Navbar'ın anında güncellenmesi için şart)
import { useAuth } from '../../../context/AuthContext';

// 2. Mutation dosyanın yolu (Senin kodundaki yola sadık kaldım)
import { LOGIN } from '../../../graphql/mutations/user';

// CSS Dosyası
import '../AuthPages.css';

const LoginPage = () => {
  const navigate = useNavigate(); // Sayfa yenilenmeden yönlendirme için
  const { login } = useAuth();    // Context içindeki login fonksiyonunu alıyoruz

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Mutation hook'u.
  // Çakışmayı önlemek için mutation fonksiyonuna 'loginMutation' ismini verdik.
  const [loginMutation, { loading, error }] = useMutation(LOGIN);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Backend'e istek at
      const { data } = await loginMutation({
        variables: { ...formData } // email ve password gider
      });

      // Başarılı yanıt geldiyse
      if (data && data.login) {
        const { token, user } = data.login;

        // 1. Context Login Fonksiyonunu Çalıştır
        // Bu işlem localStorage'a kaydeder ve Navbar'ı anında günceller.
        login(token, user.id, user);

        // 2. Ana Sayfaya (veya Feed'e) Yönlendir
        navigate('/profile'); 
      }
    } catch (err) {
      // Hatalar zaten 'error' değişkenine düşer, burada ekstra loglama yapabilirsin
      console.error("Giriş sırasında hata oluştu:", err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">
          <LoginIcon fontSize="large" /> Quill'e Giriş
        </h1>

        {/* Hata Mesajı Gösterimi (Kullanıcı dostu) */}
        {error && (
          <div style={{ 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            padding: '10px', 
            borderRadius: '5px', 
            marginBottom: '15px',
            textAlign: 'center',
            border: '1px solid #ef9a9a'
          }}>
            {error.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin."}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label><Email /> E-Posta</label>
            <input
              type="email"
              name="email"
              placeholder="ornek@email.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading} // Yüklenirken değiştirmeyi engelle
            />
          </div>

          <div className="input-group">
            <label><Lock /> Şifre</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-options">
            <Link to="/sifremi-unuttum" className="link">Şifremi Unuttum</Link>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <span>Giriş Yapılıyor...</span>
            ) : (
              "Giriş Yap"
            )}
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