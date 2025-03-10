import React from 'react';
import BookLists from '../../components/BookLists/BookLists';
import './Profile.css'; // CSS dosyasını import edin

const Profile = () => {
  const user = {
    name: "Yasin",
    username: "theyasinsahin",
    bio: "Kitap okumayan bir insan yalnızca bir hayat yaşar, okuyan ise binlere...",
    location: "Turkey, Izmir",
    email: "yasin248sahin@gmail.com",
    following: 171,
    followers: 171,
    books: [
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    ],
    favorites: [
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
      { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    ]
  };

  return (
    <div className="profile-container">
      {/* Sol Sütun - Profil Bilgileri */}
      <div className="profile-header">
        <h1>{user.name}</h1>
        <p className="username">@{user.username}</p>
        <p className="bio">{user.bio}</p>
        <div className="stats">
          <p>Takipçiler: {user.followers}</p>
          <p>Takip Edilenler: {user.following}</p>
        </div>
        <p className="location">{user.location}</p>
        <p className="email">{user.email}</p>
        <button className="edit-profile">Profili Düzenle</button>
      </div>
  
      {/* Sağ Sütun - Kitaplar */}
      <div className="content-section">
        <div className="books-section">
          <BookLists bookList={user.books} bookListTitle={"Yazdıklarım"} />
        </div>
  
        <div className="favorites-section">
          <BookLists bookList={user.favorites} bookListTitle={"Favorilerim"}/>
        </div>
      </div>
    </div>
  );
};

export default Profile;