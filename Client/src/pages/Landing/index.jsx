import React from 'react';
import HeroSection from '../../components/Landing/HeroSection';
import HowItWorks from '../../components/Landing/HowItWorks';
import FeaturedBooks from '../../components/Landing/FeaturedBooks';
import TrustedPublishers from '../../components/Landing/TrustedPublishers';

const LandingPage = () => {
  return (
    <main className="landing-page">
      <HeroSection />
      <HowItWorks />
      <FeaturedBooks />
      <TrustedPublishers />
    </main>
  );
};

export default LandingPage;