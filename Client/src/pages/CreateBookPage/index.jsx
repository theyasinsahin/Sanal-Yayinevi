import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { 
  Add, Subject, Category, Title, Tag, Close 
} from '@mui/icons-material';

// --- DATA & GRAPHQL ---
import { CREATE_BOOK_MUTATION } from '../../graphql/mutations/book';
import { GET_ALL_GENRES } from '../../graphql/queries/genre'; // YENİ EKLENDİ

// --- UI KIT IMPORTS ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Textarea } from '../../components/UI/Textarea';
import { Select } from '../../components/UI/Select';
import { Badge } from '../../components/UI/Badge';  
import ImageUpload from '../../components/ImageUpload';

import './CreateBook.css';

const CreateBookPage = () => {
  const navigate = useNavigate();
  
  // Türleri Veritabanından Çek
  const { data: genreData, loading: genresLoading } = useQuery(GET_ALL_GENRES);
  const [createBook, { loading: creating }] = useMutation(CREATE_BOOK_MUTATION);  

  // --- STATE ---
  const [bookData, setBookData] = useState({
    title: '',
    genreId: '', // Varsayılanı useEffect ile dolduracağız
    imageUrl: '',
    description: '',
    tags: [],
    // Eğer pageCount tutacaksan state'e eklemelisin:
    // pageCount: 0 
  });
  
  const [inputTag, setInputTag] = useState('');
  const [errors, setErrors] = useState({});

  // Türler yüklendiğinde varsayılan olarak ilk türü seçili yap
  useEffect(() => {
    if (genreData?.getAllGenres?.length > 0) {
      setBookData(prev => 
        prev.genreId ? prev : { ...prev, genreId: genreData.getAllGenres[0].id }
      );
    }
  }, [genreData]);

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookData(prev => ({ ...prev, [name]: value }));
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
      setBookData(prev => ({ ...prev, tags: [...prev.tags, tag] }));      
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setBookData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));   
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};
    if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
    if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";
    if (!bookData.imageUrl) newErrors.imageUrl = "Kapak resmi yüklemek zorunludur.";
    if (!bookData.genreId) newErrors.genreId = "Tür seçmek zorunludur.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const variables = {
        title: bookData.title,
        genreId: String(bookData.genreId), // ← tip güvencesi
        description: bookData.description,
        tags: bookData.tags,
        imageUrl: bookData.imageUrl,
      };

      const response = await createBook({ variables });
      navigate(`/book-detail/${response.data.createBook.id}`);

    } catch (error) {
      console.error("Hata:", error);
      setErrors({ submit: error.message });
    }
  };

  // Dinamik Select Opsiyonlarını Hazırla
  const genreOptions = genreData?.getAllGenres?.map(cat => ({
    label: cat.name,
    value: cat.id
  })) || [];

  return (
    <MainLayout>
      <div className="create-book-page">
        <Container maxWidth="4xl">
          
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
                    <div className="input-container">
                      <Select
                          label="Tür"
                          name="genreId"
                          value={bookData.genreId}
                          onChange={handleInputChange}
                          options={genreOptions}
                          icon={<Category fontSize="small" />}
                          disabled={genresLoading} // Veri yüklenirken disable et
                      />
                      {errors.genre && <Typography variant="caption" color="danger">{errors.genre}</Typography>}
                    </div>
                </div>

                {/* ... Etiketler kısmı (Senin yazdığınla aynı) ... */}
                <div className="input-wrapper">
                  <label className="input-label"><Tag fontSize="small" className="mr-1"/> Etiketler</label>
                  <div className="tags-input-container">
                    <Input 
                      name="tagInput"
                      placeholder="Etiket yazıp Enter'a basın"
                      value={inputTag}
                      onChange={(e) => setInputTag(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="mb-0" 
                    />
                    <Button type="button" variant="secondary" onClick={handleAddTag} size="medium">
                      Ekle
                    </Button>
                  </div>
                  
                  {bookData.tags.length > 0 && (
                    <div className="tags-list">
                      {bookData.tags.map((tag, index) => (
                        <Badge key={index} variant="primary">
                          {tag}
                          <Close 
                            fontSize="inherit"
                            style={{ cursor: 'pointer', marginLeft: '4px', opacity: 0.7 }}
                            onClick={() => handleRemoveTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Textarea
                    label="Açıklama"
                    name="description"
                    value={bookData.description}
                    onChange={handleInputChange}
                    rows={6}
                    placeholder="Kitabınızın konusu nedir?"
                    icon={<Subject fontSize="small" />}
                    error={errors.description}
                />

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
                    isLoading={creating}
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