import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NavigationBar from './components/NavigationBar';

import LandingPage from './components/Landing/';
import FeedPage from './components/Feed';
import { FiltersProvider } from './context/FiltersContext';

function App() {
  return (  // Add the return statement here
    <Router>
      <FiltersProvider>
      <div className='App'>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/feed" element={<FeedPage />} />
        </Routes>
      </div>
      </FiltersProvider>
    </Router>
  );
}

export default App;
