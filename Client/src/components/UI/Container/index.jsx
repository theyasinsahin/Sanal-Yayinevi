import React from 'react';
import './Container.css';

export const Container = ({ children, className = '', maxWidth = 'lg' }) => {
  return <div className={`app-container max-w-${maxWidth} ${className}`}>{children}</div>;
};