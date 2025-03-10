import React from 'react';
import './HeroSection.css';

const HeroSection = () => {
  return (
    <section className="hero-container">
      <div className="hero-content">
        <h1>Fikriniz Kitaplaşsın</h1>
        <p>Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun</p>
        <div className="cta-buttons">
          <button className="primary-cta">Yazmaya Başla</button>
          <button className="secondary-cta">Nasıl Çalışır?</button>
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