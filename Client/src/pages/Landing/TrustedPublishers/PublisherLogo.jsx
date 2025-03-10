import React from 'react';

const PublisherLogo = ({ logo, name, website }) => {
  return (
    <a 
      href={website} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="publisher-logo"
    >
      <img 
        src={logo} 
        alt={`${name} yayınevi logosu`} 
        className="logo-image" 
        loading="lazy"
      />
    </a>
  );
};

export default PublisherLogo;