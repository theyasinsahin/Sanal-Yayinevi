import React, { useState, useEffect } from 'react';
import './RangeInput.css';

const RangeInput = ({ min, max, value, onChange, formatLabel }) => {
  const [values, setValues] = useState(value);
  
  // Gradyan çubuğu için hesaplama
  useEffect(() => {
    const minPercent = ((values[0] - min) / (max - min)) * 100;
    const maxPercent = ((values[1] - min) / (max - min)) * 100;
    
    document.documentElement.style.setProperty('--min-percent', `${minPercent}%`);
    document.documentElement.style.setProperty('--max-percent', `${maxPercent}%`);
  }, [values, min, max]);

  const handleMinChange = (e) => {
    let newValue = parseInt(e.target.value) || min;
    newValue = Math.max(min, Math.min(newValue, values[1]));
    setValues([newValue, values[1]]);
    onChange([newValue, values[1]]);
  };

  const handleMaxChange = (e) => {
    let newValue = parseInt(e.target.value) || min;
    newValue = Math.max(values[0], Math.min(newValue, max));
    setValues([values[0], newValue]);
    onChange([values[0], newValue]);
  };

  return (
    <div className="range-input">
      <div className="input-container">
        <input
          type="number"
          min={min}
          max={values[1]}
          value={values[0]}
          onChange={handleMinChange}
          className="range-input__box"
          aria-label="Minimum value"
        />
        <span>ile</span>
        <input
          type="number"
          min={values[0]}
          max={max}
          value={values[1]}
          onChange={handleMaxChange}
          className="range-input__box"
          aria-label="Maximum value"
        />
      </div>
      <div className="input-labels">
        <span>{formatLabel(values[0])}</span>
        <span>{formatLabel(values[1])}</span>
      </div>
    </div>
  );
};

// Varsayılan değerler
RangeInput.defaultProps = {
  min: 0,
  max: 100,
  value: [25, 75],
  onChange: () => {},
  formatLabel: (value) => value
};

export default RangeInput;