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
      name: "Can Yayınları",
      logo: "/images/publishers/can-yayinlari.png",
      website: "https://www.canyayinlari.com/"
    },
    {
      id: 2,
      name: "İthaki Yayınları",
      logo: "/images/publishers/ithaki-yayinlari.png",
      website: "https://www.ithakiyayingrubu.com/"
    },
    {
      id: 3,
      name: "Nesin Yayınevi",
      logo: "/images/publishers/nesin-yayinlari-logo.png",
      website: "https://www.nesinyayinevi.com/"
    },
    {
      id: 4,
      name: "Melekler Yayıncılık",
      logo: "/images/publishers/logo-melekler-2022-son-.avif",
      website: "https://www.melekleryayincilik.com/"
    },
    {
      id: 5,
      name: "Ketebe Yayınları",
      logo: "/images/publishers/ketebe-logo-min.svg",
      website: "https://www.ketebe.com/"
    },
    {
      id: 6,
      name: "İletişim Yayınları",
      logo: "/images/publishers/iletisim-yayinlari.png",
      website: "https://iletisim.com.tr/"
    },
    {
      id: 7,
      name: "tubitak-yayinlari",
      logo: "/images/publishers/tubitak-yayinlari.png",
      website: "https://yayinlar.tubitak.gov.tr/"
    },
    {
      id: 8,
      name: "Yapı Kredi Yayınları",
      logo: "/images/publishers/yky-yayinlari.jfif",
      website: "https://www.yapikrediyayinlari.com.tr/"
    },/*
    {
      id: 9,
      name: "Pegasus Yayınları",
      logo: "/images/publishers/pegasus-yayinlari.png",
      website: "https://www.pegasusyayinlari.com/"
    },
    {
      id: 10,
      name: "Kronik Kitap",
      logo: "/images/publishers/kronik-kitap.png",
      website: "https://www.kronikkitap.com/"
    }*/
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