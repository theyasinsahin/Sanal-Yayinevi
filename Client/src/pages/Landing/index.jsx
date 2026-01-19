import React from 'react';
import { MainLayout } from '../../components/Layout/MainLayout'; // Layout'u kurduğumuzda

// Feature Components (Artık components klasöründen geliyorlar)
import HeroSection from '../../components/Landing/HeroSection';
import FeaturedBooks from '../../components/Landing/FeaturedBooks';
import HowItWorks from '../../components/Landing/HowItWorks';
import TrustedPublishers from '../../components/Landing/TrustedPublishers';

const LandingPage = () => {
  return (
    <MainLayout>
      <HeroSection />
      <FeaturedBooks />
      <HowItWorks />
      <TrustedPublishers />
    </MainLayout>
  );
};

export default LandingPage;