import React from 'react';
import PropTypes from 'prop-types';
import './Input.css';

export const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  icon,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && (
        <label className="input-label" htmlFor={name}>
          {icon && <span className="label-icon">{icon}</span>}
          {label} {required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className={`input-container ${error ? 'has-error' : ''}`}>
        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="form-input"
          required={required}
          {...props}
        />
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  icon: PropTypes.node,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};