import React from 'react';
import {
  EditNoteRounded,
  VolunteerActivismRounded,
  AutoStoriesRounded,
} from '@mui/icons-material';
import { Container } from '../../UI/Container';
import SectionHeading from '../SectionHeading';
import { useReveal } from '../../../hooks/useReveal';
import './HowItWorks.css';

const steps = [
  {
    Icon: EditNoteRounded,
    title: 'Yazınızı Yayınlayın',
    description: 'Platformumuzda yazınızı zengin metin editörüyle oluşturun ve hedef bağış tutarınızı belirleyin.',
  },
  {
    Icon: VolunteerActivismRounded,
    title: 'Topluluk Desteği',
    description: 'Okuyucular yazınıza bağış yaparak hedefinize ulaşmanıza yardımcı olsun.',
  },
  {
    Icon: AutoStoriesRounded,
    title: 'Kitabınız Basılsın',
    description: 'Hedef tutara ulaştığınızda profesyonel yayınevleriyle kitabınızı bastırın.',
  },
];

const Step = ({ step, index }) => {
  const reveal = useReveal();
  const { Icon } = step;
  return (
    <li ref={reveal.ref} className={`how-step ${reveal.className}`} style={reveal.style(index * 140)}>
      <span className="how-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span className="how-step-icon" aria-hidden="true"><Icon /></span>
      <h3 className="how-step-title">{step.title}</h3>
      <p className="how-step-text">{step.description}</p>
    </li>
  );
};

const HowItWorks = () => (
  <section className="how-it-works-section" id="how-it-works" aria-labelledby="how-it-works-title">
    <Container maxWidth="7xl">
      <SectionHeading
        number="02"
        eyebrow="Nasıl çalışır"
        titleId="how-it-works-title"
        title={<>Taslaktan rafa <em>üç adım</em></>}
        description="Hayalinizdeki kitabı 3 adımda gerçeğe dönüştürün."
      />
      <ol className="how-steps">
        {steps.map((step, index) => <Step key={step.title} step={step} index={index} />)}
      </ol>
    </Container>
  </section>
);

export default HowItWorks;
