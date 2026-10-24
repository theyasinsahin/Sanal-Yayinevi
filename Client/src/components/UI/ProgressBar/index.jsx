import React from 'react';
import './ProgressBar.css';

export const ProgressBar = ({ current, target }) => {
    const percentage = Math.min(100, Math.max(0, (current / target) * 100));
    
    return (
        <div className="progress-wrapper">
            <div className="progress-labels">
                <span className="current">₺{current.toLocaleString('tr-TR')}</span>
                <span className="target">Hedef: ₺{target.toLocaleString('tr-TR')}</span>
            </div>
            <div className="progress-track">
                <div 
                    className="progress-fill" 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};