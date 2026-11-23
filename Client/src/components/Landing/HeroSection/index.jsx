import React from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiX, FiArrowRight } from 'react-icons/fi';
import { Container } from '../../UI/Container';
import HeroBook3D from '../HeroBook3D';
import './HeroSection.css';

// Dergi künyesi tarihi: "Kasım 2026"
const issueDate = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date());

const HeroSection = ({ search, onSearchChange }) => (
  <section className="hero-section" aria-labelledby="home-title">
    <Container maxWidth="7xl">
      <div className="hero-wrapper">
        <div className="hero-content">
          <p className="hero-masthead">
            <span>Sanal Yayınevi</span>
            <span aria-hidden="true">·</span>
            <span>{issueDate}</span>
          </p>

          <h1 id="home-title" className="hero-title">
            Fikriniz <em className="accent-italic">kitaplaşsın.</em>
          </h1>

          <p className="hero-subtitle">
            Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun
          </p>

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

          <div className="hero-actions">
            <Link to="/feed" className="btn btn-primary btn-large">
              Keşfetmeye başla <FiArrowRight aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="hero-secondary-link">Nasıl çalışır?</a>
          </div>
        </div>

        <div className="hero-visual">
          <HeroBook3D />
        </div>
      </div>
    </Container>
  </section>
);

export default HeroSection;
