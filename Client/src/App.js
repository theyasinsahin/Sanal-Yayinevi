import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import Login from './pages/Auth/Login/Login';

function App() {
  return (  // Add the return statement here
    <Router>
      <div className='App'>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="login" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
