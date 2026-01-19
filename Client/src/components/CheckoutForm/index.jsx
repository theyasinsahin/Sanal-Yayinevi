import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const CheckoutForm = ({ amount }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe henüz yüklenmediyse işlem yapma
      return;
    }

    setIsProcessing(true);

    // 1. Ödemeyi Onayla
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Ödeme başarılı olursa kullanıcıyı bu sayfaya yönlendir
        // Burası kendi sitendeki "Teşekkürler" sayfası olmalı
        return_url: `${window.location.origin}/donation-success`,
      },
    });

    // 2. Hata Yönetimi
    // Eğer işlem başarılı olursa kullanıcı yukarıdaki URL'e yönlenir
    // Kod buraya geliyorsa bir hata oluşmuş demektir (örn: Kart reddedildi)
    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message);
    } else {
      setMessage("Beklenmedik bir hata oluştu.");
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement id="payment-element" />
      
      <button 
        disabled={isProcessing || !stripe || !elements} 
        id="submit"
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isProcessing ? "İşleniyor..." : `${amount} TL Bağışla`}
      </button>

      {/* Hata Mesajı Alanı */}
      {message && <div id="payment-message" className="text-red-500 mt-2">{message}</div>}
    </form>
  );
};

export default CheckoutForm;