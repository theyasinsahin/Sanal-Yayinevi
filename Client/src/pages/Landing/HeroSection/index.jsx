import React from 'react';
import { Link } from 'react-router-dom';
import './HeroSection.css';

// --- UI KIT IMPORTS ---
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import { Container } from '../../UI/Container';

const HeroSection = () => {
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-section">
      <Container maxWidth="7xl">
        <div className="hero-wrapper">
          
          {/* Sol taraf: Metin ve Butonlar */}
          <div className="hero-content">
            <Typography variant="h1" weight="bold" className="hero-title">
              Fikriniz Kitaplaşsın
            </Typography>
            
            <Typography variant="h4" color="muted" className="hero-subtitle">
              Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun
            </Typography>
            
            <div className="hero-actions">
              {/* Primary Button */}
              <Link to="/create-book" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="large">
                  Yazmaya Başla
                </Button>
              </Link>
              
              {/* Secondary Button */}
              <Button 
                variant="outline" 
                size="large" 
                onClick={scrollToHowItWorks}
              >
                Nasıl Çalışır?
              </Button>
            </div>
          </div>

          {/* Sağ taraf: Görsel */}
          <div className="hero-image-container">
            <img 
              src="/images/landing/hero-bg.jpg" 
              alt="Yazma süreci illüstrasyonu" 
              className="hero-img"
            />
          </div>

        </div>
      </Container>
    </section>
  );
};

export default HeroSection;