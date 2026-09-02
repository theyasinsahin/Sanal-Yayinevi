import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Home, MenuBook } from '@mui/icons-material';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';

import './PaymentResult.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('tid');
  const bookId = searchParams.get('bookId');

  return (
    <MainLayout>
      <div className="payment-result-page">
        <div className="result-card">
          
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
          
          {transactionId && (
            <div className="detail-box success">
              <span className="detail-label">İşlem Kodu:</span>
              <span className="detail-value">{transactionId}</span>
            </div>
          )}

          <div className="mt-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bookId ? (
              <>
                <Link to={`/book-detail/${bookId}`} style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="large" className="w-full" icon={<MenuBook />}>
                    Kitaba Geri Dön
                  </Button>
                </Link>
                <Link to="/feed" style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="large" className="w-full" icon={<Home />}>
                    Ana Sayfaya Dön
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/feed" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="large" className="w-full" icon={<Home />}>
                  Ana Sayfaya Dön
                </Button>
              </Link>
            )}
          </div>
          
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentSuccess;