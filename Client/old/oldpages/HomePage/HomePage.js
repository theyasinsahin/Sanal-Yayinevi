import './HomePage.css';

import React, { useState, useEffect, useRef } from "react";

import Navbar from '../../components/NavBar/NavBar';
import ContentData from '../../components/ContentData/ContentData';
import BookLists from '../../components/BookLists/BookLists';
import SearchBar from '../../../src/components/SearchBar/SearchBar';

const HomePage = () => {

  const popularBooks = [
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "" },
    // Add more book data
  ];

  const newAdditions = [
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "" },
    // Add more book data
  ];

  const newReleases = [
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "" },
    // Add more book data
  ];

  const getFilteredBooks = (bookList) => {
    if (!bookList || !bookList.term) return null;
    
    console.log("giriyom");
    const { type, term } = bookList;
    const lowercasedTerm = term.toLowerCase();

    return bookList.filter((book) => {
      // Her filtreleme tipi için arama teriminin geçtiği bir alan kontrol edilir
      if (type === 'author') {
        return book.author.toLowerCase().includes(lowercasedTerm);
      } else if (type === 'title') {
        return book.title.toLowerCase().includes(lowercasedTerm);
      } else if (type === 'genre') {
        return book.genre.toLowerCase().includes(lowercasedTerm);
      }
      return false;
    });
  };
  
  var [filteredBooks, setFilteredBooks] = useState([]);

  useEffect(() => {
  }, [filteredBooks]);

  const filteredBooksRef = useRef(null);

  const handleSearch = (type, term) => {
    // Arama türü ve terimi `BookLists` bileşenine iletmek için state güncelleniyor
    setFilteredBooks({ type, term });
    filteredBooks = getFilteredBooks([...popularBooks, ...newAdditions, ...newReleases]);
    filteredBooksRef.current = filteredBooks;
  };

  return (
      <div className='homepage'>  
        <Navbar handleSearch={handleSearch}/>
        <div className="content">
          <ContentData/>  
          { filteredBooks.length > 0 && <BookLists bookList={filteredBooks} bookListTitle={"Filtered Books"}/>}
          <BookLists bookList={popularBooks} bookListTitle={"Popular Books"}/>
          <BookLists bookList={newAdditions} bookListTitle={"New Additions"}/>
          <BookLists bookList={newReleases} bookListTitle={"New Releases"}/>

        </div>
      </div>
    );
}

export default HomePage;