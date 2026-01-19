import Iyzipay from 'iyzipay';
import iyzipay from '../config/iyzico.js';
import Transaction from '../models/transaction.js';

export const createPaymentForm = async (user, book, amount, ip) => {
    // 1. Transaction'ı PENDING olarak oluştur
    const newTransaction = new Transaction({
        userId: user._id,
        bookId: book._id,
        amount: amount,
        currency: 'TRY',
        status: 'PENDING',
        paymentProvider: 'IYZICO'
    });

    await newTransaction.save();

    // 2. Iyzico İsteği Hazırla
    // NOT: Iyzico Şehir, Ülke ve Adres bilgilerini zorunlu tutar.
    // Kullanıcıdan adres almıyorsak (Bağış sistemi olduğu için), varsayılan değerler göndermeliyiz.
    
    const buyerName = user.fullName || user.username || 'Misafir';
    const buyerSurname = 'Kullanıcı'; // Soyadı ayrı tutmuyorsan varsayılan
    const buyerEmail = user.email || 'email@yok.com';
    const buyerIp = ip || '85.85.85.85';
    
    // Adres objesini hazırlayalım (Hem billing hem shipping için kullanacağız)
    const addressInfo = {
        contactName: buyerName,
        city: 'Istanbul',           // <--- BU ALAN ZORUNLU
        country: 'Turkey',          // <--- BU ALAN ZORUNLU
        address: 'Dijital Bagis Islemi - Teslimat Gerektirmez', // <--- ZORUNLU
        zipCode: '34732'
    };

    const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: newTransaction._id.toString(),
        price: amount.toString(),
        paidPrice: amount.toString(),
        currency: Iyzipay.CURRENCY.TRY,
        basketId: newTransaction._id.toString(),
        paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
        callbackUrl: `${process.env.API_URL}/api/payment/callback`,
        
        buyer: {
            id: user._id.toString(),
            name: buyerName,
            surname: buyerSurname,
            gsmNumber: '+905555555555', // Zorunlu alan, user'da yoksa dummy
            email: buyerEmail,
            identityNumber: '11111111111', // Sandbox için zorunlu
            lastLoginDate: '2015-10-05 12:43:35',
            registrationDate: '2013-04-21 15:12:09',
            registrationAddress: addressInfo.address,
            ip: buyerIp,
            city: addressInfo.city,
            country: addressInfo.country,
            zipCode: addressInfo.zipCode
        },
        
        // Fatura Adresi (Hatanın kaynağı burasıydı)
        billingAddress: addressInfo,

        // Teslimat Adresi (Sanal ürün olsa bile zorunludur)
        shippingAddress: addressInfo,

        basketItems: [
            {
                id: book._id.toString(),
                name: book.title,
                category1: 'Bagis',
                itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, // Sanal Ürün
                price: amount.toString()
            }
        ]
    };

    // 3. Iyzico'ya Gönder ve Form İçeriğini Al
    return new Promise((resolve, reject) => {
        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
            if (err) {
                console.error("Iyzico Bağlantı Hatası:", err);
                reject(err);
            } else if (result.status !== 'success') {
                console.error("Iyzico API Hatası:", result.errorMessage);
                reject(new Error(result.errorMessage));
            } else {
                resolve({
                    htmlContent: result.checkoutFormContent,
                    token: result.token,
                    transactionId: newTransaction._id
                });
            }
        });
    });
};

export const findTransactionsByUserId = async (userId) => {
    return await Transaction.find({ userId: userId }).sort({ createdAt: -1 });
};