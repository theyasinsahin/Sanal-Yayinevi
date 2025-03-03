// components/common/ProgressBar.js
import React from 'react';
import './ProgressBar.css';
import { Paid } from '@mui/icons-material';

const ProgressBar = ({ currentAmount, goal }) => {
  return (
    <div className="progress-container">
      <div className="progress-bar" style={{ width: `${(currentAmount/goal)*100}%` }}>
        
      </div>
      <div className="progress-text">
            <Paid fontSize="small" />
            <span>{currentAmount.toLocaleString()} TL</span>
            <span>/ {goal.toLocaleString()} TL</span>
        </div>
    </div>
  );
};

export default ProgressBar;