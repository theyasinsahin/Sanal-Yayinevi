import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import './styles/feedback.css';
import './styles/printedReading.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(process.env.REACT_APP_PERFORMANCE_DEBUG === 'true'
  ? ({ name, value }) => console.info(`[Betik performance] ${name}: ${value}`)
  : undefined);

// PWA: "Ana ekrana ekle" / kurulum özelliğinin çalışabilmesi için bir
// service worker kaydı gerekiyor (bkz. serviceWorkerRegistration.js ve
// public/service-worker.js). register() sadece production build'de
// devreye girer.
serviceWorkerRegistration.register();
