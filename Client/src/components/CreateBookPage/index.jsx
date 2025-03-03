// CreateBookPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddPhotoAlternate, Add, Subject, Category, Title } from '@mui/icons-material';
import './CreateBookPage.css';

const CreateBookPage = () => {
  const [bookData, setBookData] = useState({
    title: '',
    author: '',
    category: 'roman',
    cover: null,
    description: '',
    chapters: ['']
  });
  
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();

  const categories = [
    { value: 'roman', label: 'Roman' },
    { value: 'siir', label: 'Şiir' },
    { value: 'bilimkurgu', label: 'Bilim Kurgu' },
    { value: 'tarih', label: 'Tarih' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookData(prev => ({ ...prev, [name]: value }));
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if(file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setBookData(prev => ({ ...prev, cover: file }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addChapter = () => {
    setBookData(prev => ({
      ...prev,
      chapters: [...prev.chapters, '']
    }));
  };

  const handleChapterChange = (index, value) => {
    const newChapters = [...bookData.chapters];
    newChapters[index] = value;
    setBookData(prev => ({ ...prev, chapters: newChapters }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // API çağrısı veya state yönetimi
    console.log(bookData);
    navigate('/dashboard');
  };

  return (
    <div className="create-book-container">
      <h1 className="page-title">
        <Add fontSize="large" /> Yeni Kitap Oluştur
      </h1>

      <form onSubmit={handleSubmit} className="book-form">
        {/* Kapak ve Temel Bilgiler */}
        <div className="form-section">
          <div className="cover-upload">
            <label className="upload-label">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden-input"
              />
              {preview ? (
                <img src={preview} alt="Kapak Önizleme" className="cover-preview" />
              ) : (
                <div className="upload-placeholder">
                  <AddPhotoAlternate fontSize="large" />
                  <span>Kapak Resmi Yükle</span>
                </div>
              )}
            </label>
          </div>

          <div className="basic-info">
            <div className="input-group">
              <label><Title /> Kitap Başlığı</label>
              <input
                type="text"
                name="title"
                value={bookData.title}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Subject /> Yazar Adı</label>
              <input
                type="text"
                name="author"
                value={bookData.author}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Category /> Kategori</label>
              <select
                name="category"
                value={bookData.category}
                onChange={handleInputChange}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Açıklama */}
        <div className="form-section">
          <div className="input-group">
            <label>Kitap Açıklaması</label>
            <textarea
              name="description"
              value={bookData.description}
              onChange={handleInputChange}
              rows="4"
            />
          </div>
        </div>

        {/* Bölümler */}
        <div className="form-section">
          <h3><Add /> Bölümler</h3>
          {bookData.chapters.map((chapter, index) => (
            <div key={index} className="chapter-input">
              <label>Bölüm {index + 1}</label>
              <textarea
                value={chapter}
                onChange={(e) => handleChapterChange(index, e.target.value)}
                rows="3"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addChapter}
            className="add-chapter-btn"
          >
            <Add /> Yeni Bölüm Ekle
          </button>
        </div>

        <button type="submit" className="submit-btn">
          Kitabı Yayınla
        </button>
      </form>
    </div>
  );
};

export default CreateBookPage;