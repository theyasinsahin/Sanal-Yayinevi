import React from 'react';
import { Link } from 'react-router-dom';
import '../UI/Button/Button.css';
import './printFunding.css';

export default function PrintLink({ children, variant = 'outline', className = '', ...props }) {
  return <Link {...props} className={`btn btn-${variant} btn-small print-link ${className}`}>{children}</Link>;
}
