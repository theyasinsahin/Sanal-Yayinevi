import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './PaymentSuccess.css'; // CSS dosyasını import etmeyi unutma

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('tid');

  return (
    <div className="payment-success-wrapper">
      <div className="success-card">
        
        {/* Animasyonlu İkon Alanı */}
        <div className="icon-container">
          <svg className="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <h2 className="success-title">Ödeme Başarılı!</h2>
        
        <p className="success-message">
          Desteğiniz için çok teşekkürler.<br />
          İşleminiz başarıyla kaydedildi.
        </p>
        
        {transactionId && (
            <div className="transaction-box">
                <span className="label">İşlem ID:</span>
                <span className="value">{transactionId}</span>
            </div>
        )}

        <Link to="/" className="home-button">
          Ana Sayfaya Dön
        </Link>
        
      </div>
    </div>
  );
};

export default PaymentSuccess;