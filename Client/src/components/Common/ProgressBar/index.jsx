// components/common/ProgressBar.js
import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ progress, daysLeft }) => {
  return (
    <div className="progress-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}>
        <div className="progress-text">{Math.round(progress)}%</div>
      </div>
      {daysLeft && <span className="days-left">{daysLeft}gün kaldı</span>}
    </div>
  );
};

export default ProgressBar;