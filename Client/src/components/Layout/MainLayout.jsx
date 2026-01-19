import React from 'react';
import NavigationBar from '../../components/Navigation/NavigationBar'; // Navbar'ı buraya taşıyacağız
//import Footer from '../../components/Navigation/Footer'; // Footer yapınca buraya

export const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
      <NavigationBar />
      <main className="main-content">
        {children}
      </main>
      {/* <Footer /> */}
    </div>
  );
};