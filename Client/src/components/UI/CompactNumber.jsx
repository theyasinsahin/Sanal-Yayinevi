import React from 'react';
import { formatCount, formatExactCount } from '../../utils/formatCount';
import './CompactNumber.css';

export default function CompactNumber({ value, label, className = '' }) {
  const exact = `${formatExactCount(value)}${label ? ` ${label}` : ''}`;
  const compact = formatCount(value);

  return (
    <span className={`compact-number ${className}`.trim()} title={exact}>
      {compact === exact ? compact : <>
        <span aria-hidden="true">{compact}</span>
        <span className="compact-number-exact">{exact}</span>
      </>}
    </span>
  );
}
