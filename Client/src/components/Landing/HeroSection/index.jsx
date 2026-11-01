import React from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { Typography } from '../../UI/Typography';
import { Container } from '../../UI/Container';
import './HeroSection.css';

const HeroSection = ({ search, onSearchChange }) => (
  <section className="hero-section" aria-labelledby="home-title">
    <Container maxWidth="7xl">
      <div className="hero-wrapper">
        <div className="hero-content">
          <Typography id="home-title" variant="h1" weight="bold" className="hero-title">
            Fikriniz Kitaplaşsın
          </Typography>
          <Typography variant="body" color="muted" className="hero-subtitle">
            Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun
          </Typography>
        </div>

        <form className="hero-search" role="search" aria-label="Kitap arama" onSubmit={event => event.preventDefault()}>
          <label htmlFor="home-search">Bir sonraki kitabını bul</label>
          <div className="hero-search-field">
            <FiSearch aria-hidden="true" />
            <input
              id="home-search"
              name="search"
              type="search"
              maxLength={100}
              placeholder="Kitap, yazar veya alıntı ara..."
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              aria-controls="home-books"
            />
            {search && (
              <button type="button" aria-label="Aramayı temizle" onClick={() => onSearchChange('')}>
                <FiX aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </div>
    </Container>
  </section>
);

export default HeroSection;
