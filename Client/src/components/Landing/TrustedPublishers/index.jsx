import React from 'react';
import './TrustedPublishers.css';
import PublisherLogo from './PublisherLogo';

const TrustedPublishers = () => {
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
    <section className="trusted-publishers">
      <div className="section-header">
        <h2 className="section-title">İş Birliklerimiz</h2>
        <p className="section-subtitle">Hedefe ulaşan eserlerimiz bu yayınevleriyle buluşuyor</p>
      </div>
      
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
    </section>
  );
};

export default TrustedPublishers;