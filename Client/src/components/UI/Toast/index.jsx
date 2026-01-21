import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, Error, Info, Close, Warning } from '@mui/icons-material';
import './Toast.css';

const icons = {
  success: <CheckCircle fontSize="small" />,
  error: <Error fontSize="small" />,
  info: <Info fontSize="small" />,
  warning: <Warning fontSize="small" />
};

export const Toast = ({ 
  message, 
  type = 'info', 
  isVisible, 
  onClose, 
  duration = 3000 
}) => {
  
  useEffect(() => {
    if (isVisible && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`ui-toast toast-${type}`}>
      <div className="toast-content">
        {icons[type]}
        <span>{message}</span>
      </div>
      <button onClick={onClose} className="toast-close-btn">
        <Close fontSize="small" />
      </button>
    </div>
  );
};

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'info']),
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  duration: PropTypes.number,
};