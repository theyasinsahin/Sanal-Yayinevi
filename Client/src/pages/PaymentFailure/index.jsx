import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './PaymentFailure.css'; // CSS dosyasını import ediyoruz

const PaymentFailure = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  return (
    <div className="payment-failure-wrapper">
      <div className="failure-card">
        
        {/* Animasyonlu Hata İkonu */}
        <div className="failure-icon-container">
          <svg className="failure-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>

        <h2 className="failure-title">Ödeme Başarısız</h2>
        
        <p className="failure-message">
          Maalesef işleminiz tamamlanamadı.<br />
          Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.
        </p>
        
        {/* Hata Detay Kutusu */}
        {reason && (
           <div className="error-detail-box">
             <span className="error-label">Hata Nedeni:</span>
             <span className="error-text">{decodeURIComponent(reason)}</span>
           </div>
        )}

        {/* Aksiyon Butonu */}
        <Link to="/" className="retry-button">
          Ana Sayfaya Dön ve Tekrar Dene
        </Link>
        
      </div>
    </div>
  );
};

export default PaymentFailure;