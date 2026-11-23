import React, { useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import HeroSection from '../../components/Landing/HeroSection';
import FeaturedBooks from '../../components/Landing/FeaturedBooks';
import CampaignShowcase from '../../components/Landing/CampaignShowcase';
import HowItWorks from '../../components/Landing/HowItWorks';
import TrustedPublishers from '../../components/Landing/TrustedPublishers';

const LandingPage = () => {
  const [search, setSearch] = useState('');

  return (
    <MainLayout>
      <HeroSection search={search} onSearchChange={setSearch} />
      <FeaturedBooks search={search} onClearSearch={() => setSearch('')} />
      <CampaignShowcase />
      <HowItWorks />
      <TrustedPublishers />
    </MainLayout>
  );
};

export default LandingPage;
