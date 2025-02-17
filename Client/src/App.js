import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import Login from './pages/Auth/Login/Login';
import Register from './pages/Auth/Register/Register';
import BookCreation from './components/BookCreation/BookCreation';
import Profile from './pages/Profile/Profile';

import LandingPage from './components/Landing/';

function App() {
  return (  // Add the return statement here
    <Router>
      <div className='App'>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/*
          <Route path="/" element={<HomePage />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="create-book" element={<BookCreation />} />
          <Route path="profile" element={<Profile />} />*/}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
