import React from 'react';
import { Button } from '../UI/Button';
import PrintLink from './PrintLink';
import { SIMULATE_PRINT_PAYMENT, CANCEL_PRINT_PAYMENT } from '../../graphql/printFunding';
import { Feedback, money, Status, usePrintAction } from './shared';

export default function PaymentCard({ payment, mode, refresh }) {
  const action = usePrintAction(refresh), pending = ['CREATED', 'PENDING'].includes(payment.state);
  let checkoutUrl;
  try {
    const url = new URL(payment.checkoutUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && ['sandbox-cpp.iyzipay.com', 'sandbox-api.iyzipay.com'].includes(url.hostname)) checkoutUrl = url.href;
  } catch { /* The hosted link is shown only after a verified initialization. */ }
  return <section className="print-panel"><div className="print-heading"><h3>{money(payment.amountMinor)}</h3><Status value={payment.state} /></div>
    <p className="print-sandbox">SANDBOX · Bu kayıt gerçek para hareketi değildir.</p>
    {payment.issue && <Feedback error="Ödeme sağlayıcı kaydıyla uyuşmuyor. Operasyon incelemesi gerekiyor." />}
    <p>İşlem: <code>{payment.id}</code> · {new Date(payment.createdAt).toLocaleString('tr-TR')}</p>
    <p>Karşılıksız destek: {money(payment.donationMinor)} · Ön sipariş: {payment.quantity} kitap / {money(payment.orderMinor)}</p>
    {payment.reservation && <p>Rezervasyon: <Status value={payment.reservation.state} /> · {new Date(payment.reservation.expiresAt).toLocaleString('tr-TR')}</p>}
    {payment.order && <div><h4>Ön sipariş</h4><Status value={payment.order.state} />{payment.order.carrier && <p>{payment.order.carrier} · Takip: {payment.order.trackingNumber}</p>}<p>Sipariş: <code>{payment.order.id}</code></p></div>}
    {payment.refund && <div><h4>İade</h4><Status value={payment.refund.state} /><p>{money(payment.refund.amountMinor)} · {payment.refund.reason}</p>{payment.refund.state === 'FAILED' && <p role="alert">İade henüz tamamlanamadı. Operasyon ekibi yeniden deneyecek.</p>}</div>}
    <Feedback error={action.error} message={action.message} />
    {mode === 'IYZICO_SANDBOX' && payment.provider === 'IYZICO_SANDBOX' && pending && <>
      <p>Kart bilgilerinizi iyzico'nun güvenli test ödeme sayfasında girin. Yalnızca iyzico test kartları kullanılır.</p>
      <div className="print-actions">
        {checkoutUrl ? <a className="btn btn-primary btn-medium print-link" href={checkoutUrl}>iyzico ile test kartıyla öde</a> : <p role="status">iyzico ödeme sayfası hazırlanıyor. Ödeme durumunu yeniden kontrol edin.</p>}
        <Button variant="outline" onClick={refresh}>Ödeme durumunu güncelle</Button>
        <Button variant="ghost" disabled={action.busy} onClick={() => action.run(CANCEL_PRINT_PAYMENT, { paymentId: payment.id })}>Ödemeyi iptal et</Button>
      </div>
    </>}
    {mode === 'SANDBOX' && payment.provider === 'SANDBOX' && pending && <><p>Test sağlayıcısında bir sonuç seçin. Kart bilgisi girmeyin.</p><div className="print-actions">
      <Button disabled={action.busy} onClick={() => action.run(SIMULATE_PRINT_PAYMENT, { paymentId: payment.id, outcome: 'CAPTURED' })}>Test ödemesini başarılı sonuçlandır</Button>
      <Button variant="outline" disabled={action.busy} onClick={() => action.run(SIMULATE_PRINT_PAYMENT, { paymentId: payment.id, outcome: 'FAILED' })}>Başarısız ödeme dene</Button>
      <Button variant="ghost" disabled={action.busy} onClick={() => action.run(CANCEL_PRINT_PAYMENT, { paymentId: payment.id })}>Ödemeyi iptal et</Button>
    </div></>}
    <div className="print-actions"><PrintLink to={`/book-detail/${payment.bookId}`}>Kitaba dön</PrintLink><PrintLink to="/funding-history">Destek ve ön sipariş geçmişim</PrintLink></div>
  </section>;
}
