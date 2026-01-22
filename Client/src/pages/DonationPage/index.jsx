import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { ArrowBack, CardGiftcard, Security, CreditCard } from '@mui/icons-material';

// --- GRAPHQL ---
import { INITIALIZE_PAYMENT } from '../../graphql/mutations/transaction';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Badge';

import './DonationPage.css';

const DonationPage = () => {
  const { bookId } = useParams();
  
  const [amount, setAmount] = useState(50); // Varsayılan 50 TL
  const [loadingScript, setLoadingScript] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  // 1. Kitap Bilgisini Çek
  const { data: bookData, loading: bookLoading } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !bookId
  });

  const book = bookData?.getBookById;

  // 2. Ödeme Başlatma Mutation
  const [initializePayment, { loading: paymentLoading, error }] = useMutation(INITIALIZE_PAYMENT);

  // --- Iyzico Script Enjeksiyonu ---
  // Bu fonksiyon HTML string içindeki scriptleri çalıştırılabilir hale getirir
  const injectIyzicoScript = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const formDiv = doc.getElementById('iyzipay-checkout-form');
    const container = document.getElementById('iyzico-container');
    
    if (formDiv && container) {
      container.innerHTML = ''; // Önce temizle
      container.appendChild(formDiv);
      setFormVisible(true); // Formun geldiğini state ile bildir
    }

    // Scriptleri manuel olarak çalıştır
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
    if (amount < 1) return;
    setLoadingScript(true);
    setFormVisible(false); // Yeni istekte formu geçici gizle
    
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

  // --- RENDER ---

  if (bookLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-screen">
          <Typography variant="h5">Yükleniyor...</Typography>
        </div>
      </MainLayout>
    );
  }

  if (!book) return null;

  return (
    <MainLayout>
      <div className="donation-page">
        <Container maxWidth="5xl">
          
          <Link to={`/book-detail/${bookId}`} className="back-link">
             <ArrowBack fontSize="small"/> Kitaba Dön
          </Link>

          <div className="donation-grid">
            
            {/* SOL TARAF: Bilgi ve Tutar Seçimi */}
            <div className="donation-info-card">
               <div className="card-header">
                 <div className="icon-bg">
                    <CardGiftcard fontSize="large" style={{ color: '#10B981' }} />
                 </div>
                 <div>
                   <Typography variant="h5" weight="bold">Destek Ol</Typography>
                   <Typography variant="body" color="muted">
                     Yazarın üretimine katkıda bulun.
                   </Typography>
                 </div>
               </div>

               <div className="book-summary-box">
                  <Typography variant="caption" color="muted">SEÇİLEN KİTAP</Typography>
                  <Typography variant="h6" weight="bold">{book.title}</Typography>
                  <div className="mt-2">
                    <Badge variant="neutral">{book.author?.username || "Yazar"}</Badge>
                  </div>
               </div>

               <div className="amount-selection">
                 <label className="input-label">Bağış Miktarı (TL)</label>
                 
                 {/* Hızlı Seçim Butonları */}
                 <div className="quick-amounts">
                    {[20, 50, 100, 250].map(val => (
                      <button 
                        key={val}
                        className={`amount-chip ${amount === val ? 'active' : ''}`}
                        onClick={() => setAmount(val)}
                      >
                        {val} ₺
                      </button>
                    ))}
                 </div>

                 <div className="custom-amount-input">
                    <Input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                      placeholder="Farklı bir tutar giriniz"
                      icon={<span style={{fontWeight:'bold'}}>₺</span>}
                    />
                 </div>
               </div>

               {error && (
                 <div className="error-box">
                   <Typography variant="caption" color="danger">{error.message}</Typography>
                 </div>
               )}

               <Button 
                 variant="success" 
                 size="large" 
                 className="w-full mt-4"
                 onClick={handlePaymentStart}
                 isLoading={paymentLoading || loadingScript}
                 icon={<CreditCard />}
               >
                 {paymentLoading || loadingScript ? "Form Hazırlanıyor..." : "Ödeme Formunu Aç"}
               </Button>

               <div className="security-note">
                 <Security fontSize="small" />
                 <Typography variant="caption" color="muted">
                    Ödemeniz Iyzico altyapısı ile 256-bit SSL koruması altındadır.
                 </Typography>
               </div>
            </div>

            {/* SAĞ TARAF: Iyzico Form Alanı */}
            <div className={`iyzico-wrapper ${formVisible ? 'visible' : ''}`}>
               {/* Form henüz gelmediyse placeholder göster */}
               {!formVisible && !paymentLoading && !loadingScript && (
                 <div className="placeholder-state">
                    <div className="placeholder-icon">
                       <CreditCard style={{ fontSize: 60, color: '#E5E7EB' }} />
                    </div>
                    <Typography variant="h6" color="muted">Ödeme Formu</Typography>
                    <Typography variant="body" color="muted" className="text-center">
                       Soldaki alandan tutarı belirleyip butona bastığınızda ödeme formu burada açılacaktır.
                    </Typography>
                 </div>
               )}
               
               {/* Iyzico'nun scripti buraya iframe/form basacak */}
               <div id="iyzico-container" className="iyzico-container"></div>
            </div>

          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default DonationPage;