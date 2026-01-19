import React from 'react';
import './HowItWorks.css';
import { 
  EditNoteRounded,
  VolunteerActivismRounded,
  AutoStoriesRounded 
} from '@mui/icons-material';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Container } from '../../../components/UI/Container';

const steps = [
  {
    icon: <EditNoteRounded style={{ fontSize: 48 }} />, // İkon boyutunu buradan veya CSS'ten verebiliriz
    title: "Yazınızı Yayınlayın",
    description: "Platformumuzda yazınızı zengin metin editörüyle oluşturun ve hedef bağış tutarınızı belirleyin."
  },
  {
    icon: <VolunteerActivismRounded style={{ fontSize: 48 }} />,
    title: "Topluluk Desteği",
    description: "Okuyucular yazınıza bağış yaparak hedefinize ulaşmanıza yardımcı olsun."
  },
  {
    icon: <AutoStoriesRounded style={{ fontSize: 48 }} />,
    title: "Kitabınız Basılsın",
    description: "Hedef tutara ulaştığınızda profesyonel yayınevleriyle kitabınızı bastırın."
  }
];

const HowItWorks = () => {
  return (
    <section className="how-it-works-section" id="how-it-works">
      <Container maxWidth="7xl">
        
        {/* Bölüm Başlığı */}
        <div className="section-header-center">
          <Typography variant="h2" weight="bold" className="text-center">
            Nasıl Çalışır?
          </Typography>
          <Typography variant="body" color="muted" className="text-center section-subtitle">
            Hayalinizdeki kitabı 3 adımda gerçeğe dönüştürün
          </Typography>
        </div>

        {/* Adımlar Grid Yapısı */}
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div className="step-card" key={index}>
              
              {/* Adım Numarası (Arka planda silik şekilde) */}
              <div className="step-number-bg">{index + 1}</div>
              
              {/* İkon */}
              <div className="step-icon-wrapper">
                {step.icon}
              </div>

              {/* İçerik */}
              <div className="step-content">
                <Typography variant="h4" weight="medium" className="step-title">
                  {step.title}
                </Typography>
                
                <Typography variant="body" color="muted">
                  {step.description}
                </Typography>
              </div>
            </div>
          ))}
        </div>

      </Container>
    </section>
  );
};

export default HowItWorks;