import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../UI/Badge';
import './PrintedBookCard.css';

export default function PrintedBookCard({ book }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return <Link to={`/book-detail/${book.id}`} className="printed-book-card">
    <div className="printed-book-cover">
      {book.imageUrl && failedUrl !== book.imageUrl ? <img src={book.imageUrl} alt={`${book.title} kapağı`} loading="lazy" onError={() => setFailedUrl(book.imageUrl)} /> : <span>{book.title}</span>}
    </div>
    <div className="printed-book-card-body">
      <Badge variant="neutral">Basılı eser</Badge>
      <h2>{book.title}</h2>
      <p className="printed-book-author">{book.printedAuthor}</p>
      <p>{book.publisher} · {book.publicationYear}</p>
      <p>{book.pageCount} sayfa{book.isbn ? ` · ISBN ${book.isbn}` : ''}</p>
      <span className="ui-text-link">Kitabı incele</span>
    </div>
  </Link>;
}
