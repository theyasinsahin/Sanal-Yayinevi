import React from 'react';
import PropTypes from 'prop-types';

const PublisherLogo = ({ logo, name, website }) => {
  return (
    <a 
      href={website} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="publisher-logo-link"
      title={`${name} web sitesini ziyaret et`} // Tooltip için
    >
      <div className="logo-wrapper">
        <img 
          src={logo} 
          alt={`${name} Logosu`} 
          className="publisher-img" 
          loading="lazy"
        />
      </div>
    </a>
  );
};

PublisherLogo.propTypes = {
  logo: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  website: PropTypes.string.isRequired,
};

export default PublisherLogo;