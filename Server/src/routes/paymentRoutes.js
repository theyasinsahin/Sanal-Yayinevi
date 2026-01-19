import express from 'express';
import iyzipay from '../config/iyzico.js'; // Iyzico yapılandırman
import Transaction from '../models/transaction.js';
import Book from '../models/book.js';

const router = express.Router();

router.post('/callback', async (req, res) => {
    // Iyzico, form dönüşünde body içinde 'token' gönderir.
    const { token } = req.body;

    if (!token) {
        return res.status(400).send('Token not found');
    }

    // Bu token ile Iyzico'ya soruyoruz: "Bu işlemin akıbeti nedir?"
    iyzipay.checkoutForm.retrieve({
        locale: 'tr',
        conversationId: '123456789', // Log takibi için sabit veya rastgele ID
        token: token
    }, async (err, result) => {
        
        if (err) {
            console.error('Iyzico Bağlantı Hatası:', err);
            return res.redirect(`${process.env.CLIENT_URL}/payment/failure?reason=connection_error`);
        }

        // ÖDEME BAŞARILI MI?
        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
            try {
                // Biz formu oluştururken basketId'ye kendi transaction._id'mizi koymuştuk.
                const transactionId = result.basketId; 
                
                const transaction = await Transaction.findById(transactionId);
                
                if (transaction && transaction.status !== 'SUCCESS') {
                    // 1. Transaction'ı Güncelle
                    transaction.status = 'SUCCESS';
                    transaction.paymentProviderId = result.paymentId; // Iyzico ID'si
                    transaction.paidAt = new Date();
                    await transaction.save();

                    // 2. Kitabın İstatistiklerini Güncelle (Para Ekle)
                    // Not: transaction.amount zaten veritabanında kayıtlı
                    await Book.findByIdAndUpdate(transaction.bookId, {
                        $inc: { 
                            currentFunding: transaction.amount, 
                            backerCount: 1 
                        }
                    });
                }

                // 3. Frontend'e Yönlendir (Success Page)
                return res.redirect(`${process.env.CLIENT_URL}/payment/success?tid=${transactionId}`);

            } catch (dbError) {
                console.error('Veritabanı Kayıt Hatası:', dbError);
                return res.redirect(`${process.env.CLIENT_URL}/payment/failure?reason=db_error`);
            }
        } else {
            // ÖDEME BAŞARISIZ
            const errorMessage = result.errorMessage || 'Ödeme tamamlanamadı';
            console.log('Ödeme Başarısız:', errorMessage);
            
            // Veritabanında durumu FAILED yapalım
            if (result.basketId) {
                await Transaction.findByIdAndUpdate(result.basketId, { status: 'FAILED' });
            }

            // Frontend'e Yönlendir (Failure Page)
            return res.redirect(`${process.env.CLIENT_URL}/payment/failure?reason=${encodeURIComponent(errorMessage)}`);
        }
    });
});

export default router;