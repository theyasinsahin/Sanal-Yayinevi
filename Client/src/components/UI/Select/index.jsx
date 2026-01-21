import React from 'react';
import PropTypes from 'prop-types';
import '../Input/Input.css'; // Input stillerini ortak kullanıyoruz!

export const Select = ({
  label,
  name,
  value,
  onChange,
  options = [],
  icon,
  error,
  required = false,
  disabled = false,
  className = '',
  placeholder = "Seçiniz",
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
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="form-input custom-select"
          required={required}
          style={{ appearance: 'none', backgroundColor: '#fff', cursor: 'pointer' }}
          {...props}
        >
            {/* Opsiyonel: Placeholder gibi davranan ilk seçenek */}
            {/* <option value="" disabled>{placeholder}</option> */}
            
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
        
        {/* Sağ tarafa küçük bir ok ikonu ekleyelim (CSS ile de yapılabilir ama basit olsun) */}
        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280' }}>
            ▼
        </div>
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
};

Select.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string
  })),
  icon: PropTypes.node,
  error: PropTypes.string,
};