import React from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Book3D } from '../../components/UI/Book3D';
import './NotFoundPage.css';

const NotFoundPage = () => (
  <MainLayout>
    <div className="notfound-page">
      <Container maxWidth="6xl">
        <div className="notfound-content">

          {/* Raftan düşen kitap: sayfa kayıp */}
          <div className="notfound-visual" aria-hidden="true">
            <span className="notfound-number">404</span>
            <div className="notfound-book">
              <Book3D alt="" size="lg" angle={-32} tilt={false} />
            </div>
          </div>

          <div className="notfound-text">
            <p className="eyebrow">Sayfa bulunamadı</p>
            <h1 className="notfound-title">
              Bu sayfa <em>kitapta yok.</em>
            </h1>
            <p className="notfound-subtitle">
              Aradığınız sayfa ya hiç yazılmadı, ya kaldırıldı ya da
              rafın başka bir köşesine taşınmış olabilir.
            </p>
            <div className="notfound-actions">
              <Link to="/" className="btn btn-primary btn-large">Ana Sayfaya Dön</Link>
              <Link to="/feed" className="btn btn-outline btn-large">Kitapları Keşfet</Link>
            </div>
          </div>

        </div>
      </Container>
    </div>
  </MainLayout>
);

export default NotFoundPage;
