import React, { useState } from 'react';
import './RangeInput.css';

const RangeInput = ({ min, max, value, onChange, formatLabel }) => {
  const [values, setValues] = useState(value);

  const handleMinChange = (e) => {
    const newValue = Math.min(parseInt(e.target.value), values[1]);
    setValues([newValue, values[1]]);
    onChange([newValue, values[1]]);
  };

  const handleMaxChange = (e) => {
    const newValue = Math.max(parseInt(e.target.value), values[0]);
    setValues([values[0], newValue]);
    onChange([values[0], newValue]);
  };

  return (
    <div className="range-input">
      <div className="input-container">
        <input
          type="number"
          min={min}
          max={max}
          value={values[0]}
          onChange={handleMinChange}
          className="range-input__box"
        />
        <span>to</span>
        <input
          type="number"
          min={min}
          max={max}
          value={values[1]}
          onChange={handleMaxChange}
          className="range-input__box"
        />
      </div>
      <div className="input-labels">
        <span>{formatLabel(values[0])}</span>
        <span>{formatLabel(values[1])}</span>
      </div>
    </div>
  );
};

export default RangeInput;
