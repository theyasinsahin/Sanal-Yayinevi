import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { 
  Add, 
  Subject, 
  Category, 
  Title, 
  Tag, 
  AutoStories,
  Close // Etiket silmek için
} from '@mui/icons-material';

// --- DATA & GRAPHQL ---
import { CREATE_BOOK_MUTATION } from '../../graphql/mutations/book'; // Yolunu kontrol et
import { genres } from '../../Data/genresData';

// --- UI KIT IMPORTS ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';

// --- COMPONENTS ---
import ImageUpload from '../../components/ImageUpload';

import './CreateBook.css';

const CreateBookPage = () => {
  const navigate = useNavigate();
  const [createBook, { loading }] = useMutation(CREATE_BOOK_MUTATION);  

  // --- STATE ---
  const [bookData, setBookData] = useState({
    title: '',
    genre: 'roman', // Varsayılan değer
    imageUrl: '',
    description: '',
    tags: [],
  });
  
  const [inputTag, setInputTag] = useState('');
  const [errors, setErrors] = useState({});

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookData(prev => ({ ...prev, [name]: value }));
    // Hata varsa temizle
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleImageSuccess = (url) => {
    setBookData(prev => ({ ...prev, imageUrl: url }));
    if (errors.imageUrl) setErrors(prev => ({ ...prev, imageUrl: null }));
  };

  // --- TAG YÖNETİMİ ---
  const handleAddTag = () => {
    const tag = inputTag.trim();
    if (tag && !bookData.tags.includes(tag)) {
      setBookData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));      
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setBookData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));   
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Form submit olmasın
      handleAddTag();
    }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasyon
    let newErrors = {};
    if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
    if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";
    if (!bookData.imageUrl) newErrors.imageUrl = "Kapak resmi yüklemek zorunludur.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const variables = {
        title: bookData.title,
        genre: bookData.genre,
        description: bookData.description,
        tags: bookData.tags,
        imageUrl: bookData.imageUrl,
        pageCount: parseInt(bookData.pageCount)
      };

      const response = await createBook({ variables });
      
      // Başarılıysa yönlendir
      navigate(`/book-detail/${response.data.createBook.id}`);

    } catch (error) {
      console.error("Hata:", error);
      setErrors({ submit: error.message });
    }
  };

  // Genres verisi object ise array'e çevir, array ise direkt kullan
  const genreList = Array.isArray(genres) ? genres : Object.values(genres);

  return (
    <MainLayout>
      <div className="create-book-page">
        <Container maxWidth="4xl">
          
          {/* Header */}
          <div className="page-header">
            <Typography variant="h4" weight="bold" className="flex items-center gap-2">
              <Add fontSize="large" style={{ color: '#2563EB' }} /> 
              Yeni Kitap Oluştur
            </Typography>
            <Typography variant="body" color="muted">
              Eserinizi yayınlayın ve okuyucularla buluşturun.
            </Typography>
          </div>

          <div className="create-book-card">
            <form onSubmit={handleSubmit} className="book-form-grid">
              
              {/* --- SOL KOLON: GÖRSEL --- */}
              <div className="form-left-col">
                <Typography variant="h6" className="section-title">Kapak Görseli</Typography>
                
                <div className="cover-upload-wrapper">
                  <ImageUpload 
                      onUploadSuccess={handleImageSuccess} 
                      label="Kapak Yükle"
                      currentImage={bookData.imageUrl}
                  />
                </div>
                {errors.imageUrl && (
                  <Typography variant="caption" color="danger" className="mt-2 block">
                    {errors.imageUrl}
                  </Typography>
                )}
                <Typography variant="caption" color="muted" className="mt-2 block text-center">
                  Önerilen Boyut: 300x450px
                </Typography>
              </div>

              {/* --- SAĞ KOLON: BİLGİLER --- */}
              <div className="form-right-col">
                
                {/* Başlık */}
                <Input
                  label="Kitap Başlığı"
                  name="title"
                  placeholder="Örn: Sefiller"
                  value={bookData.title}
                  onChange={handleInputChange}
                  icon={<Title fontSize="small" />}
                  error={errors.title}
                  required
                />

                <div className="form-row-2">
                  {/* Tür Seçimi (Select Custom Style) */}
                  <div className="input-wrapper">
                    <label className="input-label"><Category fontSize="small" className="mr-1"/> Tür</label>
                    <div className="input-container">
                      <select
                        name="genre"
                        value={bookData.genre}
                        onChange={handleInputChange}
                        className="form-input custom-select"
                      >
                        {genreList.map(cat => (
                          <option key={cat.slug} value={cat.slug}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                {/* Etiketler */}
                <div className="input-wrapper">
                  <label className="input-label"><Tag fontSize="small" className="mr-1"/> Etiketler</label>
                  <div className="tags-input-container">
                    <Input 
                      name="tagInput"
                      placeholder="Etiket yazıp Enter'a basın"
                      value={inputTag}
                      onChange={(e) => setInputTag(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="mb-0" // Input'un kendi margin'ini sıfırlıyoruz
                    />
                    <Button type="button" variant="secondary" onClick={handleAddTag} size="medium">
                      Ekle
                    </Button>
                  </div>
                  
                  {/* Etiket Listesi */}
                  {bookData.tags.length > 0 && (
                    <div className="tags-list">
                      {bookData.tags.map((tag, index) => (
                        <span key={index} className="tag-pill">
                          {tag}
                          <Close 
                            fontSize="small" 
                            className="tag-remove-icon" 
                            onClick={() => handleRemoveTag(tag)}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Açıklama (Textarea Custom Style) */}
                <div className="input-wrapper">
                  <label className="input-label"><Subject fontSize="small" className="mr-1"/> Açıklama</label>
                  <div className={`input-container ${errors.description ? 'has-error' : ''}`}>
                    <textarea
                      name="description"
                      value={bookData.description}
                      onChange={handleInputChange}
                      rows="6"
                      className="form-input form-textarea"
                      placeholder="Kitabınızın konusu nedir?"
                    />
                  </div>
                  {errors.description && <span className="input-error-message">{errors.description}</span>}
                </div>

                {/* Submit Butonu */}
                <div className="form-actions">
                  {errors.submit && (
                    <div className="error-banner mb-4">
                      {errors.submit}
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="large" 
                    className="w-full"
                    isLoading={loading}
                  >
                    Kitabı Yayınla
                  </Button>
                </div>

              </div>
            </form>
          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default CreateBookPage;