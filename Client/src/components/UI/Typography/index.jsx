import React from 'react';
import PropTypes from 'prop-types';
import './Typography.css';

// varyantlar: h1, h2, h3, h4, h5, h6, body, caption, small
export const Typography = ({ 
  variant = 'body', 
  tag, 
  children, 
  className = '', 
  color = 'default',
  weight = 'normal',
  ...props 
}) => {
  // Eğer tag belirtilmezse varyanta göre otomatik seç
  const Component = tag || (variant.startsWith('h') ? variant : 'p');

  return (
    <Component 
      className={`typography ${variant} color-${color} weight-${weight} ${className}`} 
      {...props}
    >
      {children}
    </Component>
  );
};

Typography.propTypes = {
  variant: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption', 'small']),
  tag: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  color: PropTypes.string,
  weight: PropTypes.oneOf(['normal', 'medium', 'bold']),
};