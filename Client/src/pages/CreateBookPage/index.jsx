// CreateBookPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddPhotoAlternate, Add, Subject, Category, Title, Tag } from '@mui/icons-material';
import './CreateBookPage.css';
import { CREATE_BOOK_MUTATION } from './graphql';
import { useMutation } from '@apollo/client';

const CreateBookPage = () => {

  const [createBook] = useMutation(CREATE_BOOK_MUTATION);  

  const [inputTag, setInputTag] = useState();
  
  const handleAddTag = () => {
    if (inputTag && !bookData.tags.includes(inputTag)) {
      setBookData(prevState => ({
        ...prevState,
        tags: [...prevState.tags, inputTag]
      }));      
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setBookData(prevState => ({
      ...prevState,
      tags: prevState.tags.filter(tag => tag !== tagToRemove)
    }));  
  };

  const [bookData, setBookData] = useState({
    title: '',
    author: '',
    genre: 'roman',
    cover: null,
    description: '',
    chapters: [''],
    tags: [],
  });
  
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();

  const genres = [
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

  const [errors, setErrors] = useState({});

const handleSubmit = (e) => {
  e.preventDefault();
  
  let newErrors = {};

  if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
  if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  // Hata yoksa kitabı kaydet
  createBook({
    variables: {
      title: bookData.title,
      genre: bookData.genre,
      description: bookData.description,
      tags: bookData.tags
    }
  }).then(response => {
    console.log("Kitap başarıyla oluşturuldu:", response.data.createBook);
  }).catch(error => {
    console.error("Kitap oluşturulurken hata:", error);
    setErrors({ submit: "Kitap oluşturulurken bir hata oluştu." });
  });

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
          <div className="book-info"> 
            
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
                />
                {errors.title && <span className="error-message">{errors.title}</span>}

              </div>

              <div className="input-group">
                <label><Category /> Tür</label>
                <select
                  name="genre"
                  value={bookData.genre}
                  onChange={handleInputChange}
                >
                  {genres.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label><Tag /> Etiketler</label>
                <input
                  type="text"
                  name="tags"
                  value={inputTag}
                  onChange={(e) => setInputTag(e.target.value)}
                />

                <p className='add-tag-button' onClick={handleAddTag}>Etiket Ekle</p>
                <div className="tags">
                  {bookData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="tag"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div> 

              
            </div>
            {/* Açıklama */}
            <div className="book-description">
              <div className="input-group">
                <label>Kitap Açıklaması</label>
                <textarea
                  name="description"
                  value={bookData.description}
                  onChange={handleInputChange}
                  rows="4"
                />
                {errors.description && <span className="error-message">{errors.description}</span>}

              </div>
            </div> 
          </div>  
        </div>

        <button type="submit" className="submit-btn">
          Kitabı Yayınla
        </button>
      </form>
    </div>
  );
};

export default CreateBookPage;