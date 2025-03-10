import React, { useState } from 'react';
import './CustomDropdown.css';

const CustomDropdown = ({ options, selectedFont, onFontChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="dropdown">
      <button
        className="dropdown-button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ fontFamily: selectedFont }}
      >
        {selectedFont || 'Select Font'}
      </button>
      {isOpen && (
        <ul className="dropdown-list">
          {options.map((option) => (
            <li
              key={option}
              className="dropdown-item"
              style={{ fontFamily: option }}
              onClick={() => {
                onFontChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomDropdown;
