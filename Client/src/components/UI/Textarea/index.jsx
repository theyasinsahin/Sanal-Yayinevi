import React from 'react';
import PropTypes from 'prop-types';
import '../Input/Input.css'; // Input stillerini ortak kullanıyoruz!

export const Textarea = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon,
  error,
  required = false,
  disabled = false,
  rows = 4,
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
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="form-input form-textarea" // form-input Input.css'ten geliyor
          required={required}
          style={{ resize: 'vertical', minHeight: '100px', fontFamily: 'inherit' }}
          {...props}
        />
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
};

Textarea.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  icon: PropTypes.node,
  error: PropTypes.string,
  rows: PropTypes.number,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
};