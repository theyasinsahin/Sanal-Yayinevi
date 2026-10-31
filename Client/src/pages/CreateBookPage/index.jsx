import ClassificationFields, { emptyClassification, classificationError, classificationInput } from '../../components/Books/Classification/ClassificationFields';
import { bookPath } from '../../utils/publicPaths';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { 
  Add, Subject, Title
} from '@mui/icons-material';

// --- DATA & GRAPHQL ---
import { CREATE_BOOK_MUTATION } from '../../graphql/mutations/book';

// --- UI KIT IMPORTS ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Textarea } from '../../components/UI/Textarea';
import ImageUpload from '../../components/ImageUpload';

import './CreateBook.css';

const CreateBookPage = () => {
  const navigate = useNavigate();
  
  const [createBook, { loading: creating }] = useMutation(CREATE_BOOK_MUTATION);  

  // --- STATE ---
  const [bookData, setBookData] = useState({
    title: '',
    imageUrl: '',
    description: '',
    // Eğer pageCount tutacaksan state'e eklemelisin:
    // pageCount: 0 
  });
  
  const [classification, setClassification] = useState(emptyClassification);
  const [errors, setErrors] = useState({});

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

  // --- SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};
    if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
    if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";
    if (!bookData.imageUrl) newErrors.imageUrl = "Kapak resmi yüklemek zorunludur.";

    const invalid = classificationError(classification);
    if (invalid) newErrors.classification = invalid;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const variables = {
        title: bookData.title,
        classification: classificationInput(classification),
        description: bookData.description,
        imageUrl: bookData.imageUrl,
      };

      const response = await createBook({ variables });
      navigate(bookPath(response.data.createBook));

    } catch (error) {
      console.error("Hata:", error);
      setErrors({ submit: error.message });
    }
  };

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

                <ClassificationFields value={classification} onChange={setClassification} disabled={creating} />
                {errors.classification && <p role="alert">{errors.classification}</p>}

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
