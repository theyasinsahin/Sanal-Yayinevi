import React from 'react';
import PropTypes from 'prop-types';
import './Button.css';

export const Button = ({ 
  children, 
  variant = 'primary', // primary, secondary, outline, ghost
  size = 'medium', // small, medium, large
  isLoading = false,
  disabled = false,
  icon,
  onClick,
  className = '',
  type = 'button',
  ...props 
}) => {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <span className="spinner">...</span> // Buraya Spinner ikonu gelebilir
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  isLoading: PropTypes.bool,
  onClick: PropTypes.func,
  // ... diğerleri
};