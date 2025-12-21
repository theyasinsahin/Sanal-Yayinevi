// client/src/components/BookCard.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom'; // Link kullandığın için lazım
import BookCard from './BookCard'; // Yolunu kontrol et

// Sahte bir kitap verisi
const mockBook = {
    id: '1',
    title: 'Harry Potter',
    author: {
        username: 'jkrowling'
    },
    imageUrl: 'https://via.placeholder.com/150',
    stats: {
        likes: 10,
        views: 100
    },
    tags: ['Fantastik']
};

test('BookCard bileşeni kitap başlığını ve yazarını doğru render ediyor mu?', () => {
    render(
        <BrowserRouter>
            <BookCard book={mockBook} />
        </BrowserRouter>
    );

    // Ekranda "Harry Potter" yazısı var mı?
    expect(screen.getByText('Harry Potter')).toBeInTheDocument();
    
    // Ekranda "@jkrowling" yazısı var mı?
    expect(screen.getByText(/@jkrowling/i)).toBeInTheDocument();
});