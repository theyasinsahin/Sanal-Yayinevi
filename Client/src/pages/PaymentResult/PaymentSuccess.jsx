import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Home } from '@mui/icons-material';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';

import './PaymentResult.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('tid');

  return (
    <MainLayout>
      <div className="payment-result-page">
        <div className="result-card">
          
          {/* Animasyonlu İkon */}
          <div className="icon-wrapper success">
            <CheckCircle className="result-icon" />
          </div>

          <Typography variant="h4" weight="bold" className="mb-2">
            Ödeme Başarılı!
          </Typography>
          
          <Typography variant="body" color="muted">
            Desteğiniz için teşekkür ederiz.<br />
            İşleminiz başarıyla kaydedildi ve yazar bilgilendirildi.
          </Typography>
          
          {/* İşlem ID Kutusu */}
          {transactionId && (
            <div className="detail-box success">
              <span className="detail-label">İşlem Kodu:</span>
              <span className="detail-value">{transactionId}</span>
            </div>
          )}

          <div className="mt-6">
            <Link to="/feed" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="large" className="w-full" icon={<Home />}>
                Ana Sayfaya Dön
              </Button>
            </Link>
          </div>
          
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentSuccess;