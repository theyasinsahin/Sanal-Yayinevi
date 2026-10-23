import React from 'react';
import './TrustedPublishers.css';
import PublisherLogo from './PublisherLogo';

// --- UI KIT IMPORTS ---
import { Typography } from '../../UI/Typography';
import { Container } from '../../UI/Container';

const TrustedPublishers = () => {
  // Gerçek uygulamada bu veriler API'den veya bir config dosyasından gelebilir
  const publishers = [
    {
      id: 1,
      name: "Melekler Yayıncılık",
      logo: "/images/publishers/melekler-yayincilik-logo.avif",
      website: "https://www.melekleryayincilik.com/"
    },
  ];

  return (
    <section className="trusted-publishers-section">
      <Container maxWidth="7xl">
        
        {/* Başlık Alanı */}
        <div className="section-header-center">
          <Typography variant="h4" weight="bold" color="default" className="text-center">
            İş Birliği
          </Typography>
          <Typography variant="body" color="muted" className="text-center section-subtitle">
            Hedefe ulaşan eserlerimiz değerli Melekler Yayıncılık ile buluşuyor.
          </Typography>
        </div>
        
        {/* Logolar Grid */}
        <div className="publishers-grid">
          {publishers.map(publisher => (
            <PublisherLogo
              key={publisher.id}
              logo={publisher.logo}
              name={publisher.name}
              website={publisher.website}
            />
          ))}
        </div>

      </Container>
    </section>
  );
};

export default TrustedPublishers;