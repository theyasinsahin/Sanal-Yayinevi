import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { INITIALIZE_PAYMENT } from '../../graphql/mutations/transaction';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';

// CSS dosyasını import etmeyi unutma
import './DonationPage.css';

const DonationPage = () => {
  const { bookId } = useParams();
  
  const [amount, setAmount] = useState(50);
  const [loadingScript, setLoadingScript] = useState(false);

  // Kitap Bilgisini Çek
  const { data: bookData, loading: bookLoading } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !bookId
  });

  const bookTitle = bookData?.getBookById?.title;

  // Ödeme Başlatma Mutation
  const [initializePayment, { loading: paymentLoading, error }] = useMutation(INITIALIZE_PAYMENT);

  const injectIyzicoScript = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const formDiv = doc.getElementById('iyzipay-checkout-form');
    const container = document.getElementById('iyzico-container');
    
    if (formDiv && container) {
      container.innerHTML = '';
      container.appendChild(formDiv);
    }

    const scripts = doc.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const scriptElement = document.createElement('script');
      if (scripts[i].src) {
        scriptElement.src = scripts[i].src;
      } else {
        scriptElement.innerHTML = scripts[i].innerHTML;
      }
      document.body.appendChild(scriptElement);
    }
  };

  const handlePaymentStart = async () => {
    setLoadingScript(true);
    
    try {
      const { data } = await initializePayment({
        variables: { 
          bookId: bookId, 
          amount: parseFloat(amount) 
        }
      });

      if (data && data.initializePayment.htmlContent) {
        injectIyzicoScript(data.initializePayment.htmlContent);
      }
    } catch (err) {
      console.error("Ödeme hatası:", err);
    } finally {
      setLoadingScript(false);
    }
  };

  if (bookLoading) {
      return (
        <div className="donation-page-wrapper">
             <div className="loading-spinner"></div>
        </div>
      );
  }

  return (
    <div className="donation-page-wrapper">
      <div className="donation-container">
        
        <div className="donation-header">
          <h2>{bookTitle || "Kitap"} İçin Destek Ol</h2>
          <p className="donation-subtext">Güvenli ödeme altyapısı ile bağış yapın.</p>
        </div>

        {/* Tutar Giriş Alanı */}
        <div className="amount-section">
          <label className="input-label">
            Bağış Miktarı (TL)
          </label>
          <div className="input-group">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="amount-input"
              placeholder="Tutar giriniz"
            />
            <button
              onClick={handlePaymentStart}
              disabled={paymentLoading || loadingScript}
              className="pay-button"
            >
              {paymentLoading || loadingScript ? "Yükleniyor..." : "Ödeme Formunu Aç"}
            </button>
          </div>
          {error && <div className="error-message">{error.message}</div>}
        </div>

        <hr className="divider" />

        {/* Iyzico Form Alanı */}
        <div id="iyzico-container" className="responsive">
          {!paymentLoading && !loadingScript && (
            <p className="placeholder-text">
              Ödeme formu bu alanda güvenli bir şekilde görüntülenecektir.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default DonationPage;