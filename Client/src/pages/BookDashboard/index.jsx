// BookDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import { Add, Save, FolderOpen, Edit } from '@mui/icons-material';
import { sampleBooks } from '../../Data/sampleBooks';
import 'react-quill/dist/quill.snow.css'; // Make sure this is imported
import './BookDashboard.css';

const BookDashboard = () => {
  const { bookId } = useParams() || { bookId: 1 };
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [content, setContent] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    // Simulating API call with sample data
    const loadBook = sampleBooks.find(b => b.id === parseInt(bookId) || 1);
    if (loadBook) {
      setBook(loadBook);
      setChapters(loadBook.chapters || []);
      
      // Auto-select first chapter if available
      if (loadBook.chapters && loadBook.chapters.length > 0) {
        setSelectedChapter(loadBook.chapters[0].id);
        setContent(loadBook.chapters[0].content || '');
      }
    }
  }, [bookId]);

  const handleContentChange = (value) => {
    setContent(value);
    setIsSaved(false);
  };

  const addNewChapter = () => {
    if (newChapterTitle.trim()) {
      const newChapter = {
        id: Date.now(),
        title: newChapterTitle,
        content: '',
        lastModified: new Date().toISOString()
      };
      setChapters(prev => [...prev, newChapter]);
      setNewChapterTitle('');
      setSelectedChapter(newChapter.id);
      setContent('');
    }
  };

  const handleChapterSelect = (chapterId) => {
    if (!isSaved) {
      if (window.confirm('Değişiklikleriniz kaydedilmedi. Devam etmek istiyor musunuz?')) {
        const chapter = chapters.find(c => c.id === chapterId);
        setSelectedChapter(chapterId);
        setContent(chapter?.content || '');
        setIsSaved(true);
      }
    } else {
      const chapter = chapters.find(c => c.id === chapterId);
      setSelectedChapter(chapterId);
      setContent(chapter?.content || '');
    }
  };

  const saveChapter = () => {
    if (selectedChapter) {
      setChapters(prev => prev.map(ch => 
        ch.id === selectedChapter ? 
        { ...ch, content, lastModified: new Date().toISOString() } : 
        ch
      ));
      setIsSaved(true);
    }
  };

  // Custom modules for ReactQuill
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ]
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent', 'link'
  ];

  return (
    <div className="book-dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="book-info-dashboard">
          <img 
            src={book?.imageUrl || 'https://via.placeholder.com/120x170'} 
            alt={book?.title || 'Book Cover'} 
            className="book-cover" 
          />
          <h2>{book?.title || 'Kitap Başlığı'}</h2>
          <p className="author">{book?.author || 'Yazar'}</p>
          <div className="stats">
            <span>{chapters.length} Bölüm</span>
            <span>{book?.genre || 'Kategori'}</span>
          </div>
        </div>

        <div className="chapter-management">
          <div className="new-chapter">
            <input
              type="text"
              placeholder="Yeni Bölüm Başlığı"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewChapter()}
            />
            <button onClick={addNewChapter}>
              <Add fontSize="small" /> Ekle
            </button>
          </div>

          <div className="chapter-list">
            {chapters.map(chapter => (
              <div
                key={chapter.id}
                className={`chapter-item ${selectedChapter === chapter.id ? 'active' : ''}`}
                onClick={() => handleChapterSelect(chapter.id)}
              >
                <FolderOpen className="icon" fontSize="small" />
                <span className="title">{chapter.title}</span>
                <span className="date">
                  {new Date(chapter.lastModified).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="editor-area">
        <div className="editor-header">
          <h3>
            <Edit fontSize="small" /> {chapters.find(c => c.id === selectedChapter)?.title || 'Bölüm Seçin'}
          </h3>
          <button 
            onClick={saveChapter} 
            className="save-btn"
            disabled={isSaved || !selectedChapter}
          >
            <Save fontSize="small" /> Kaydet
          </button>
        </div>

        <ReactQuill
          theme="snow"
          value={content}
          onChange={handleContentChange}
          modules={modules}
          formats={formats}
          className="custom-quill-editor"
          placeholder="Yazmaya başlayın..."
        />
      </div>
    </div>
  );
};

export default BookDashboard;