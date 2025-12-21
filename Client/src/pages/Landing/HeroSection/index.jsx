import React from 'react';
import { Link } from 'react-router-dom';
import './HeroSection.css';

const HeroSection = () => {
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      // 'smooth' parametresi kaymanın yumuşak olmasını sağlar
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-container">
      <div className="hero-content">
        <h1>Fikriniz Kitaplaşsın</h1>
        <p>Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun</p>
        <div className="cta-buttons">
          {/* 2. Button etiketini Link ile değiştirdik */}
          <Link to="/create-book" className="primary-cta">
            Yazmaya Başla
          </Link>          
          <button className="secondary-cta" onClick={scrollToHowItWorks}>Nasıl Çalışır?</button>
        </div>
      </div>
      <div className="hero-image">
        {/* Resimler public klasörüne atılacak */}
        <img src="/images/landing/hero-bg.jpg" alt="Writing process illustration" />
      </div>
    </section>
  );
};

export default HeroSection;