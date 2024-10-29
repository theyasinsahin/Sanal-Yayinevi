import React from 'react';
import './Navbar.css';

const Navbar = () => {
  const genres = [
    "Bilim-Kurgu", "Romantik", "Ütopik", "Distopik", 
    "Fantastik", "Biyografi", "Tarih", "Macera", "Gizem", "Kişisel Gelişim",
    "Polisiye"
  ];

  return (
    <div className="navbar">
      <h3 className="explore">Keşfet</h3>
      {genres.map((genre, index) => (
        <button key={index} className="navbar-item">
          {genre}
        </button>
      ))}
    </div>
  );
};

export default Navbar;
