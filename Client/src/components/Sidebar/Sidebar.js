import React, { useState } from 'react';
import './Sidebar.css';

const SideBarMenu = () => {
  const [isBooksOpen, setIsBooksOpen] = useState(false);

  const toggleBooksMenu = () => {
    setIsBooksOpen(!isBooksOpen);
  };

  return (
    <div className="sidebar">
      <div className='logo-div'>
        <img src="./images/logo/logo.png" alt="Logo" className='logo' />
      </div>
      <div className="profile-part">
        {/* You can replace this with an actual image */}
        <img src="./images/user-avatar.png" alt="User" className="profile-image" />
        <div className='user-info'>
          <h5>Yasin Şahin</h5>
          <h5>yasin248sahin@gmail.com</h5>
        </div>
        
      </div>
      <button className="menu-item">Profilim</button>
      
      <div className="menu-item" onClick={toggleBooksMenu}>
        Kitaplarım
      </div>
      {isBooksOpen && (
        <div className="submenu">
          <button className="submenu-item">Yayınlanmış</button>
          <button className="submenu-item">Yazmaya Devam Et</button>
        </div>
      )}

      <button className="menu-item">Listem</button>
      <button className="menu-item">Yıldızladıklarım</button>
    </div>
  );
};

export default SideBarMenu;
