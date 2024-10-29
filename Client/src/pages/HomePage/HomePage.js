import './HomePage.css';

import React from "react";

import Navbar from '../../components/NavBar/NavBar';
import Sidebar from '../../components/Sidebar/Sidebar';
import ContentData from '../../components/ContentData/ContentData';
import BookLists from '../../components/BookLists/BookLists';
const HomePage = () => {
    return (
        <div>  
          <Sidebar />
          <Navbar />
          <div className="content">
            <ContentData/>  
            <BookLists/>
          </div>
        </div>
      );
}

export default HomePage;