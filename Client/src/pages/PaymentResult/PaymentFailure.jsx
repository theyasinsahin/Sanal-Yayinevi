import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ErrorOutline, Replay } from '@mui/icons-material';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';

import './PaymentResult.css';

const PaymentFailure = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  return (
    <MainLayout>
      <div className="payment-result-page">
        <div className="result-card">
          
          {/* Hata İkonu */}
          <div className="icon-wrapper failure">
            <ErrorOutline className="result-icon" />
          </div>

          <Typography variant="h4" weight="bold" className="mb-2">
            Ödeme Başarısız
          </Typography>
          
          <Typography variant="body" color="muted">
            Maalesef işleminiz tamamlanamadı.<br />
            Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.
          </Typography>
          
          {/* Hata Detayı */}
          {reason && (
            <div className="detail-box failure">
              <strong>Hata Nedeni:</strong><br/>
              {decodeURIComponent(reason)}
            </div>
          )}

          <div className="mt-6">
            {/* Burada window.history.back() veya belirli bir rotaya yönlendirme yapılabilir */}
            <Link to="/feed" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="large" className="w-full" icon={<Replay />}>
                Ana Sayfaya Dön ve Tekrar Dene
              </Button>
            </Link>
          </div>
          
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentFailure;