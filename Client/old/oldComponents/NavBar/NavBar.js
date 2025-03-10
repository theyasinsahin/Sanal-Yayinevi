import React from 'react';
import { FaBookOpen, FaUser, FaHeart, FaPenAlt, FaSearch } from 'react-icons/fa';
import { GiBookshelf } from 'react-icons/gi';
import { MdMenu } from 'react-icons/md';

import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar bg-primary-dark text-white px-6 py-4 shadow-xl fixed w-full z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Logo & Ana Menü */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2 hover:text-secondary-gold transition-colors">
            <GiBookshelf className="text-3xl" />
            <span className="text-xl font-bold">KitapAtölye</span>
          </a>
          
          <div className="hidden lg:flex items-center gap-6">
            <a href="/turkler" className="hover:text-secondary-gold flex items-center gap-2">
              <FaBookOpen /> Türler
            </a>
            <a href="/yazarlar" className="hover:text-secondary-gold flex items-center gap-2">
              <FaUser /> Yazarlar
            </a>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-8">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Kitaplarda ara..."
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-accent-blue focus:outline-none focus:ring-2 focus:ring-secondary-gold"
            />
            <FaSearch className="absolute right-3 top-3 text-gray-400" />
          </div>
        </div>

        {/* Kullanıcı İşlemleri */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-6">
            <a href="/yaz" className="bg-accent-blue hover:bg-blue-600 px-4 py-2 rounded-lg flex items-center gap-2">
              <FaPenAlt /> Yeni Kitap
            </a>
            <a href="/profil" className="hover:text-secondary-gold">
              <FaUser className="text-xl" />
            </a>
            <a href="/favoriler" className="hover:text-secondary-gold relative">
              <FaHeart className="text-xl" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-xs rounded-full px-1.5">3</span>
            </a>
          </div>
          
          {/* Mobile Menu */}
          <button className="lg:hidden text-2xl">
            <MdMenu />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown (Gizli) */}
      <div className="lg:hidden bg-primary-dark py-4 px-6">
        {/* Mobile menü içeriği */}
      </div>
    </nav>
  );
};

export default Navbar;