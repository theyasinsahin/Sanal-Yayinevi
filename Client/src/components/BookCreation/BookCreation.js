import React, { useState } from 'react';
import './BookCreation.css';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Book3D from './Book3D';
import CustomDropdown from './CustomDropDown';

const BookCreation = () => {
  const [title, setTitle] = useState('');
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [selectedFont, setSelectedFont] = useState('Aladdin'); // Default font
  const [fontSizePx, setFontSizePx] = useState(16); // Default font size in px
  const [fontColor, setFontColor] = useState('#333333'); // Default color
  const [hasBorder, setHasBorder] = useState(false); // Default: No border
  const [borderColor, setBorderColor] = useState('#000000'); // Default border color
  const [borderWidth, setBorderWidth] = useState(0.03); // Default border width

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPhoto(url);
    }
  };

  const [inputTag, setInputTag] = useState('');
  const [tags, setTags] = useState([]);

  const handleAddTag = () => {
    if (inputTag && !tags.includes(inputTag)) {
      setTags([...tags, inputTag]);
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="book-creation-page">
      <div className="book-container">
        <div className="book-form">
          <h2>Create a New Book</h2>
          <div className="input-group">
            <label>Book Title:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter book title"
            />
          </div>
          <div className="input-group">
            <label>Title Font:</label>
            <CustomDropdown
            options={['Aladdin', 'Alba', 'Aldo', 'Alev', 'Allembert']}
            selectedFont={selectedFont}
            onFontChange={(font) => setSelectedFont(font)}
          />
          </div>
          <div className="input-group">
            <label>Font Size (px):</label>
            <input
                  type="range"
                  value={fontSizePx}
                  onChange={(e) => setFontSizePx(parseInt(e.target.value))}
                  step="1"
                  min="12"
                  max="48"
                />
                <span>{(fontSizePx).toFixed(1)}</span>
          </div>
          <div className="input-group">
            <label>Font Color:</label>
            <input
              type="color"
              value={fontColor}
              onChange={(e) => setFontColor(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Border:</label>
            <input
              type="checkbox"
              checked={hasBorder}
              onChange={(e) => setHasBorder(e.target.checked)}
            />
            {hasBorder && (
              <>
                <label>Border Color:</label>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  style={{ marginLeft: '10px' }}
                />
                <label>Border Width:</label>
                <input
                  type="range"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(parseFloat(e.target.value))}
                  step="0.01"
                  min="0.01"
                  max="0.1"
                />
                <span>{(borderWidth * 16).toFixed(1)} px</span>
              </>
            )}
          </div>
          <div className="input-group">
            <label>Cover Photo:</label>
            <input type="file" onChange={handleFileChange} />
          </div>
          
          
          <div className="input-group">
            <label>Tags:</label>
            <input
              type="text"
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              placeholder="Add a tag"
            />
            <button onClick={handleAddTag}>Add Tag</button>
            <div className="tags">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="tag"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag} x
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="book-preview">
          <Canvas camera={{ position: [0, 1, 5] }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
            <Book3D
              title={title}
              coverPhoto={coverPhoto || './images/books/yuzyillik-yalnizlik.png'}
              font={selectedFont}
              fontSizePx={fontSizePx}
              fontColor={fontColor}
              hasBorder={hasBorder}
              borderColor={borderColor}
              borderWidth={borderWidth}
            />
            <OrbitControls enableZoom={false} />
          </Canvas>
        </div>
      </div>
    </div>
  );
};

export default BookCreation;
