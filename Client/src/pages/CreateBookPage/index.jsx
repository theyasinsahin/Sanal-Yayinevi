import ClassificationFields, { emptyClassification, classificationError, classificationInput } from '../../components/Books/Classification/ClassificationFields';
import React, { useRef, useState } from 'react';
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

import { DOCKER_DEV, IMAGE_UPLOAD_ENABLED } from '../../config/integrations';
import './CreateBook.css';

const CreateBookPage = () => {
  const navigate = useNavigate();
  const formRef = useRef(null);
  
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
  const [classificationReady, setClassificationReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const blocked = !classificationReady || uploading || (!DOCKER_DEV && !IMAGE_UPLOAD_ENABLED && !bookData.imageUrl);
  const [errors, setErrors] = useState({});
  const focusField = name => {
    const field = formRef.current?.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = field.querySelector('input:not([type="file"]), select, textarea, button') || field;
    control.focus({ preventScroll: true });
  };

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

    if (creating || blocked) return;
    let newErrors = {};
    if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
    if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";
    if (!bookData.imageUrl) newErrors.imageUrl = "Kapak resmi yüklemek zorunludur.";

    const invalid = classificationError(classification);
    if (invalid) newErrors.classification = invalid;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      requestAnimationFrame(() => focusField(['imageUrl', 'title', 'classification', 'description'].find(name => newErrors[name])));
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
      navigate(`/dashboard/${response.data.createBook.id}`);

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
              Kitabınızı taslak olarak kaydedin, bölümlerinizi yazın ve hazır olduğunuzda yayınlayın.
            </Typography>
          </div>

          <div className="create-book-card">
            <form ref={formRef} onSubmit={handleSubmit} className="book-form-grid" noValidate aria-busy={creating}>
              {Object.keys(errors).some(name => name !== 'submit' && errors[name]) && (
                <div className="create-book-errors" role="alert">
                  <strong>Taslağı kaydetmek için eksik alanları tamamlayın.</strong>
                  <ul>{['imageUrl', 'title', 'classification', 'description'].filter(name => errors[name]).map(name => (
                    <li key={name}><button type="button" onClick={() => focusField(name)}>{errors[name]}</button></li>
                  ))}</ul>
                </div>
              )}
              
              {/* --- SOL KOLON: GÖRSEL --- */}
              <div className={`form-left-col ${errors.imageUrl ? 'create-field-invalid' : ''}`} data-field="imageUrl" tabIndex={-1} aria-describedby={errors.imageUrl ? 'cover-error' : undefined}>
                <Typography variant="h6" className="section-title">Kapak Görseli</Typography>
                
                <div className="cover-upload-wrapper">
                  <ImageUpload 
                      disabled={creating}
                      onLoadingChange={setUploading}
                      onError={message => setErrors(prev => ({ ...prev, imageUrl: message }))}
                      onUploadSuccess={handleImageSuccess} 
                      label="Kapak Yükle"
                      currentImage={bookData.imageUrl}
                  />
                </div>
                {DOCKER_DEV && <Button type="button" variant="outline" disabled={creating || uploading} onClick={() => handleImageSuccess(new URL('/images/development-book-cover.svg', window.location.origin).href)}>Yerel örnek kapağı kullan</Button>}
                {!IMAGE_UPLOAD_ENABLED && !bookData.imageUrl && <p role="alert">{DOCKER_DEV ? 'Kapak yükleme bu ortamda devre dışı. Devam etmek için yerel örnek kapağı seçebilirsiniz.' : 'Kapak yükleme bu ortamda devre dışı. Kitap oluşturmak için kapak zorunludur; yöneticinin görsel yükleme entegrasyonunu etkinleştirmesi gerekiyor.'}</p>}
                {uploading && <p role="status">Kapak yükleniyor; tamamlandığında taslağı kaydedebilirsiniz.</p>}
                {errors.imageUrl && (
                  <Typography id="cover-error" variant="caption" color="danger" className="create-field-error">
                    {errors.imageUrl}
                  </Typography>
                )}
                <Typography variant="caption" color="muted" className="mt-2 block text-center">
                  Önerilen Boyut: 300x450px
                </Typography>
              </div>

              {/* --- SAĞ KOLON: BİLGİLER --- */}
              <div className="form-right-col">
                
                <div data-field="title" className={errors.title ? 'create-field-invalid' : ''}>
                <Input
                  label="Kitap Başlığı"
                  name="title"
                  placeholder="Örn: Sefiller"
                  value={bookData.title}
                  onChange={handleInputChange}
                  icon={<Title fontSize="small" />}
                  error={errors.title}
                  aria-invalid={Boolean(errors.title)}
                  disabled={creating}
                  required
                />
                </div>

                <div data-field="classification" tabIndex={-1} className={errors.classification ? 'create-field-invalid' : ''} aria-describedby={errors.classification ? 'classification-error' : undefined}>
                <ClassificationFields onReadyChange={setClassificationReady} value={classification} onChange={value => {
                  setClassification(value);
                  if (errors.classification) setErrors(prev => ({ ...prev, classification: classificationError(value) || null }));
                }} disabled={creating} />
                {errors.classification && <p id="classification-error" className="create-field-error">{errors.classification}</p>}
                </div>

                <div data-field="description" className={errors.description ? 'create-field-invalid' : ''}>
                <Textarea
                    label="Açıklama"
                    name="description"
                    value={bookData.description}
                    onChange={handleInputChange}
                    rows={6}
                    placeholder="Kitabınızın konusu nedir?"
                    icon={<Subject fontSize="small" />}
                    error={errors.description}
                    aria-invalid={Boolean(errors.description)}
                    disabled={creating}
                />
                </div>

                <div className="form-actions">
                  {errors.submit && (
                    <div className="error-banner mb-4" role="alert">
                      {errors.submit}
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="large" 
                    className="w-full"
                    disabled={blocked}
                    isLoading={creating}
                  >
                    Taslak Olarak Kaydet
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
