import React from 'react';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import FeaturedBooks from './FeaturedBooks';
import TrustedPublishers from './TrustedPublishers';

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