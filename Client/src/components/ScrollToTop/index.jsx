// src/components/ScrollToTop/index.jsx
//
// Uygulama genelinde çalışan tek bir "scroll to top" bileşeni.
// react-router'ın URL'sini (pathname) izler; her route değişiminde
// sayfayı en üste kaydırır. Bunu tek tek her sayfaya (FeedPage,
// SessionDetail, vb.) useEffect eklemek yerine, App.js'te SADECE BİR
// KEZ <ScrollToTop /> olarak kullanmanız yeterli — Router'ın hemen
// içine, Routes ile aynı seviyeye koyun (render ettiği bir şey yok,
// null döner).
//
// Kullanım (App.js içinde):
//
//   <BrowserRouter>
//     <ScrollToTop />
//     <Routes>
//       ...
//     </Routes>
//   </BrowserRouter>

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;