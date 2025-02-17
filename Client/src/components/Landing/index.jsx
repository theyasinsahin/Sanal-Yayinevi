import React from 'react';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import FeaturedArticles from './FeaturedArticles';
import TrustedPublishers from './TrustedPublishers';

const LandingPage = () => {
  return (
    <main className="landing-page">
      <HeroSection />
      <HowItWorks />
      <FeaturedArticles />
      <TrustedPublishers />
    </main>
  );
};

export default LandingPage;