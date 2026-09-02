import React from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <MainLayout>
      <div className="notfound-page">
        <Container maxWidth="lg">
          <div className="notfound-content">

            <div className="notfound-ornament">❦</div>

            <div className="notfound-number">
              <span className="notfound-quote">❝</span>
              404
              <span className="notfound-quote notfound-quote--close">❞</span>
            </div>

            <Typography variant="h2" weight="bold" className="notfound-title">
              Bu Sayfa Kitapta Yok
            </Typography>

            <Typography variant="body" color="muted" className="notfound-subtitle">
              Aradığınız sayfa ya hiç yazılmadı, ya kaldırıldı ya da
              rafın başka bir köşesine taşınmış olabilir.
            </Typography>

            <div className="notfound-actions">
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="large">
                  Ana Sayfaya Dön
                </Button>
              </Link>
              <Link to="/feed" style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="large">
                  Kitapları Keşfet
                </Button>
              </Link>
            </div>

            <div className="notfound-stamp">Sayfa Bulunamadı</div>

          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default NotFoundPage;