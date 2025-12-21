import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Add, Subject, Category, Title, Tag, AutoStories } from '@mui/icons-material';
import './CreateBookPage.css';
import { CREATE_BOOK_MUTATION } from './graphql'; // Dosya yolunun doğruluğundan emin olun
import { useMutation } from '@apollo/client';
import { genres } from '../../Data/genresData';
import ImageUpload from '../../components/ImageUpload'; // ImageUpload bileşenini import et

const CreateBookPage = () => {
  const navigate = useNavigate();
  const [createBook, { loading }] = useMutation(CREATE_BOOK_MUTATION);  

  // --- TAG YÖNETİMİ ---
  const [inputTag, setInputTag] = useState('');
  
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

  // --- FORM STATE ---
  // Başlangıç değerleri '' (boş string) olmalı, null değil!
  const [bookData, setBookData] = useState({
    title: '',
    genre: 'roman',
    imageUrl: '', // cover yerine imageUrl kullanıyoruz (String URL)
    description: '',
    tags: [],
  });
  
  const [errors, setErrors] = useState({});

  // --- HANDLERS ---

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookData(prev => ({ ...prev, [name]: value }));
  };

  // ImageUpload bileşeninden gelen URL'i state'e atar
  const handleImageSuccess = (url) => {
    setBookData(prev => ({ ...prev, imageUrl: url }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let newErrors = {};
    if (!bookData.title.trim()) newErrors.title = "Kitap başlığı zorunludur.";
    if (!bookData.description.trim()) newErrors.description = "Açıklama zorunludur.";
    if (!bookData.imageUrl) newErrors.imageUrl = "Kapak resmi yüklemek zorunludur.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Backend'e gönderilecek veriler
      const variables = {
        title: bookData.title,
        genre: bookData.genre,
        description: bookData.description,
        tags: bookData.tags,
        imageUrl: bookData.imageUrl,
        // Sayıyı Integer'a çeviriyoruz (400 hatasını önler)
        pageCount: bookData.pageCount ? parseInt(bookData.pageCount) : 0 
      };

      const response = await createBook({ variables });
      
      // Başarılı olursa Dashboard'a veya Detay sayfasına yönlendir
      // Kitabı düzenlemek için Dashboard daha mantıklı olabilir
      navigate(`/dashboard/${response.data.createBook.id}`);

    } catch (error) {
      console.error("Kitap oluşturulurken hata:", error);
      setErrors({ submit: "Kitap oluşturulurken bir hata oluştu: " + error.message });
    }
  };

  return (
    <div className="create-book-container">
      <h1 className="page-title">
        <Add fontSize="large" /> Yeni Kitap Oluştur
      </h1>

      <form onSubmit={handleSubmit} className="book-form">
        <div className="form-section">
          <div className="book-info"> 
            
            {/* --- KAPAK RESMİ YÜKLEME --- */}
            <div className="cover-upload-section" style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
               <div style={{ width: '200px', height: '300px' }}>
                  <ImageUpload 
                      onUploadSuccess={handleImageSuccess} 
                      label="Kapak Yükle"
                      currentImage={bookData.imageUrl}
                  />
               </div>
               {errors.imageUrl && <span className="error-message">{errors.imageUrl}</span>}
            </div>

            <div className="basic-info">
              
              <div className="input-group">
                <label><Title /> Kitap Başlığı</label>
                <input
                  type="text"
                  name="title"
                  value={bookData.title}
                  onChange={handleInputChange}
                  placeholder="Örn: Sefiller"
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
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

               

              <div className="input-group">
                <label><Tag /> Etiketler</label>
                <div style={{display:'flex', gap:'10px'}}>
                    <input
                    type="text"
                    value={inputTag}
                    onChange={(e) => setInputTag(e.target.value)}
                    placeholder="Etiket yazıp ekleye basın"
                    />
                    <button type="button" className='add-tag-button' onClick={handleAddTag} style={{whiteSpace:'nowrap'}}>
                        Ekle
                    </button>
                </div>

                <div className="tags">
                  {bookData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="tag"
                      onClick={() => handleRemoveTag(tag)}
                      title="Silmek için tıkla"
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
                <label><Subject /> Kitap Açıklaması</label>
                <textarea
                  name="description"
                  value={bookData.description}
                  onChange={handleInputChange}
                  rows="6"
                  placeholder="Kitabınızın konusu nedir?"
                />
                {errors.description && <span className="error-message">{errors.description}</span>}
              </div>
            </div> 

          </div>  
        </div>
        
        {errors.submit && <div className="error-banner">{errors.submit}</div>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Oluşturuluyor..." : "Kitabı Yayınla ve Bölüm Ekle"}
        </button>
      </form>
    </div>
  );
};

export default CreateBookPage;