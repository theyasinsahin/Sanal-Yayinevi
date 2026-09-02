import React from 'react';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { validatePassword } from '../../../utils/PasswordValidation';
import './PasswordStrengthIndicator.css';

const PasswordStrengthIndicator = ({ password }) => {
  if (!password) return null;

  const { results } = validatePassword(password);
  const passedCount = results.filter(r => r.passed).length;

  const strengthLabel = ['', 'Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'][passedCount];
  const strengthClass = ['', 'very-weak', 'weak', 'medium', 'good', 'strong'][passedCount];

  return (
    <div className="password-strength-wrapper">
      {/* Güç Barı */}
      <div className="strength-bars">
        {[1,2,3,4,5].map(i => (
          <div 
            key={i} 
            className={`strength-bar ${i <= passedCount ? `filled ${strengthClass}` : ''}`} 
          />
        ))}
        <span className={`strength-label ${strengthClass}`}>{strengthLabel}</span>
      </div>

      {/* Kural Listesi */}
      <ul className="password-rules-list">
        {results.map(rule => (
          <li key={rule.id} className={`rule-item ${rule.passed ? 'passed' : 'failed'}`}>
            {rule.passed 
              ? <CheckCircle fontSize="inherit" className="rule-icon passed" />
              : <Cancel fontSize="inherit" className="rule-icon failed" />
            }
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;