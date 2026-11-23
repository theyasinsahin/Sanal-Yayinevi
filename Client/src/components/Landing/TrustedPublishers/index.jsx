import React from 'react';
import PublisherLogo from './PublisherLogo';
import { Container } from '../../UI/Container';
import './TrustedPublishers.css';

// Gerçek uygulamada bu veriler API'den veya bir config dosyasından gelebilir
const publishers = [
  {
    id: 1,
    name: 'Melekler Yayıncılık',
    logo: '/images/publishers/melekler-yayincilik-logo.avif',
    website: 'https://www.melekleryayincilik.com/',
  },
];

const TrustedPublishers = () => (
  <section className="trusted-publishers-section" aria-labelledby="publishers-title">
    <Container maxWidth="7xl">
      <div className="publishers-strip">
        <div className="publishers-copy">
          <p className="publishers-eyebrow">İş birliği</p>
          <h2 id="publishers-title" className="publishers-title">
            Hedefe ulaşan eserlerimiz değerli <em>Melekler Yayıncılık</em> ile buluşuyor.
          </h2>
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
      </div>
    </Container>
  </section>
);

export default TrustedPublishers;
