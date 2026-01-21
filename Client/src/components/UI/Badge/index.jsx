import React from 'react';
import PropTypes from 'prop-types';
import './Badge.css';

export const Badge = ({ children, variant = 'neutral', className = '' }) => {
  return (
    <span className={`ui-badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
};

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['success', 'warning', 'danger', 'neutral', 'primary']),
  className: PropTypes.string,
};