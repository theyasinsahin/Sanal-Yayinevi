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
      name: "Klasik Kitap",
      logo: "/images/publishers/klasik.png",
      website: "https://ornekyayinevi1.com"
    },
    {
      id: 2,
      name: "Modern Yayınlar",
      logo: "/images/publishers/modern.png",
      website: "https://ornekyayinevi2.com"
    },
    {
      id: 3,
      name: "Bilim Kurgu Yayın",
      logo: "/images/publishers/bilimkurgu.png",
      website: "https://ornekyayinevi3.com"
    },
    {
      id: 4,
      name: "Anadolu Kitaplığı",
      logo: "/images/publishers/anadolu.png",
      website: "https://ornekyayinevi4.com"
    }
  ];

  return (
    <section className="trusted-publishers-section">
      <Container maxWidth="7xl">
        
        {/* Başlık Alanı */}
        <div className="section-header-center">
          <Typography variant="h4" weight="bold" color="default" className="text-center">
            İş Birliklerimiz
          </Typography>
          <Typography variant="body" color="muted" className="text-center section-subtitle">
            Hedefe ulaşan eserlerimiz bu değerli yayınevleriyle buluşuyor
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