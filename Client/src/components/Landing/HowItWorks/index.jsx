import React from 'react';
import './HowItWorks.css';
import { 
  EditNoteRounded,
  VolunteerActivismRounded,
  AutoStoriesRounded 
} from '@mui/icons-material';

const steps = [
  {
    icon: <EditNoteRounded fontSize="large" />,
    title: "Yazınızı Yayınlayın",
    description: "Platformumuzda yazınızı zengin metin editörüyle oluşturun ve hedef bağış tutarınızı belirleyin"
  },
  {
    icon: <VolunteerActivismRounded fontSize="large" />,
    title: "Topluluk Desteği",
    description: "Okuyucular yazınıza bağış yaparak hedefinize ulaşmanıza yardımcı olsun"
  },
  {
    icon: <AutoStoriesRounded fontSize="large" />,
    title: "Kitabınız Basılsın",
    description: "Hedef tutara ulaştığınızda profesyonel yayınevleriyle kitabınızı bastırın"
  }
];

const HowItWorks = () => {
  return (
    <section className="how-it-works">
      <h2 className="section-title">Nasıl Çalışır?</h2>
      <div className="steps-container">
        {steps.map((step, index) => (
          <div className="step-card" key={index}>
            <div className="step-number">{index + 1}</div>
            <div className="step-icon">{step.icon}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-description">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;