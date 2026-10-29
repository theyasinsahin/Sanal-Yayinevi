import React, { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../context/AuthContext';
import { PRINT_OVERVIEW, START_PRINT_CHECKOUT, MY_FUNDING_PAYMENT } from '../../graphql/printFunding';
import { CampaignCard, Feedback, money, toMinor, checkoutKey, usePrintAction } from '../../components/PrintFunding/shared';
import PaymentCard from '../../components/PrintFunding/PaymentCard';

export default function PrintCheckoutPage() {
  const { bookId } = useParams(), { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(PRINT_OVERVIEW, { variables: { bookId }, fetchPolicy: 'network-only', pollInterval: 15000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  const [donation, setDonation] = useState('50'), [quantity, setQuantity] = useState(0), [payment, setPayment] = useState(null), [attempted, setAttempted] = useState(false), [accepted, setAccepted] = useState(false);
  const [shippingAddress, setAddress] = useState({ fullName: '', phone: '', city: '', district: '', postalCode: '', line: '', consent: false });
  const { data: currentPayment, refetch: refreshPayment, error: paymentError } = useQuery(MY_FUNDING_PAYMENT, { variables: { id: payment?.id }, skip: !payment, fetchPolicy: 'network-only', pollInterval: 15000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  const key = useRef(null), action = usePrintAction(refetch), campaign = data?.printOverview?.campaign;
  const mode = data?.printPaymentMode;
  const paymentsEnabled = ['SANDBOX', 'IYZICO_SANDBOX'].includes(mode);
  let donationMinor = 0, validAmount = true; try { donationMinor = toMinor(donation); } catch { validAmount = false; }
  const total = (campaign?.unitPriceMinor || 0) * quantity + donationMinor;
  const storageKey = `betik-checkout:${user?.id}:${campaign?.id}`;
  async function start(event) {
    event.preventDefault(); if (!validAmount || !accepted) return;
    try { if (!key.current) { key.current = sessionStorage.getItem(storageKey) || checkoutKey(); sessionStorage.setItem(storageKey, key.current); } }
    catch (failure) { action.setError(failure.message); return; }
    setAttempted(true);
    const result = await action.run(START_PRINT_CHECKOUT, { input: { campaignId: campaign.id, idempotencyKey: key.current, quantity, donationMinor, ...(quantity ? { shippingAddress } : {}) } });
    if (result) setPayment(result.startPrintCheckout);
  }
  return <MainLayout><div className="print-page"><Link to={`/book-detail/${bookId}`}>← Kitaba dön</Link><h1>Destek ve kitap ön siparişi</h1>
    <p className="print-sandbox">{mode === 'IYZICO_SANDBOX' ? 'iyzico test ortamı · Test kartlarıyla ödeme ve ön sipariş akışını kullanabilirsiniz. Gerçek para tahsil edilmez.' : 'Yalnızca sandbox testi. Gerçek ödeme alınmaz; fiziksel teslimat taahhüdü oluşmaz.'}</p>
    {loading && !campaign && <p role="status">Kampanya yükleniyor…</p>}<Feedback error={error || action.error || paymentError} />
    {campaign && <CampaignCard campaign={campaign} />}
    {data && !campaign && <p className="ui-notice">Kitabın onaylı destek kampanyası yok.</p>}
    {payment ? <><PaymentCard payment={currentPayment?.myFundingPayment || payment} mode={mode} refresh={async () => { await refreshPayment(); await refetch(); }} />
      {!['CREATED', 'PENDING'].includes((currentPayment?.myFundingPayment || payment).state) && <Button variant="outline" onClick={() => { sessionStorage.removeItem(storageKey); key.current = null; setPayment(null); setAttempted(false); setAccepted(false); }}>Yeni test işlemi hazırla</Button>}
    </> : campaign && <section className="print-panel">
      {!paymentsEnabled && <p className="ui-notice">Ödemeler kapalı. Test ödeme sistemi sunucuda etkinleştirilmelidir.</p>}
      {!user && <p><Link to="/login">Devam etmek için giriş yapın.</Link></p>}
      <form className="print-form" onSubmit={start}><fieldset disabled={action.busy || attempted || !paymentsEnabled || !user || campaign.state !== 'ACTIVE'}><legend>Sepet</legend>
        <label>Fiziksel kitap adedi<input aria-label="Fiziksel kitap adedi" type="number" min="0" max={campaign.policy.maxOrderQuantity} step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><p>Kitap başına {money(campaign.unitPriceMinor)}. Kargo ve vergi onaylanmış fiyata dahildir. Ön sipariş teslimat hakkı oluşturur; kampanya başarısız olursa tam iade edilir.</p>
        <label>İlave karşılıksız destek (TL)<input inputMode="decimal" value={donation} onChange={e => setDonation(e.target.value)} required /></label>
        <div className="print-quick-amounts">{campaign.policy.quickAmountsMinor.map(value => <Button key={value} size="small" variant="outline" onClick={() => setDonation(String(value / 100))}>{money(value)}</Button>)}<Button variant="ghost" onClick={() => setDonation('0')}>İlave destek yok</Button></div>
        <p>Karşılıksız destek fiziksel kitap hakkı vermez. Destek sınırı: {money(campaign.policy.donationMinMinor)} – {money(campaign.policy.donationMaxMinor)}. Aynı sepette kitap ve ilave destek seçebilirsiniz.</p>
        {quantity > 0 && <fieldset><legend>Teslimat bilgileri</legend>{[['fullName', 'Alıcı adı soyadı'], ['phone', 'Telefon'], ['city', 'İl'], ['district', 'İlçe'], ['postalCode', 'Posta kodu'], ['line', 'Açık adres']].map(([name, label]) => <label key={name}>{label}<input required maxLength={name === 'line' ? 500 : 120} autoComplete={name === 'fullName' ? 'shipping name' : name === 'line' ? 'shipping street-address' : 'off'} value={shippingAddress[name]} onChange={e => setAddress({ ...shippingAddress, [name]: e.target.value })} /></label>)}<label className="print-check"><input type="checkbox" required checked={shippingAddress.consent} onChange={e => setAddress({ ...shippingAddress, consent: e.target.checked })} />Teslimat bilgilerimin sipariş işlemleri amacıyla yetkili operasyon tarafından işlenmesini kabul ediyorum. Bilgiler yazara ve diğer okurlara gösterilmez.</label></fieldset>}
        <label className="print-check"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />Sepetin tam bedeline, rezervasyon süresine ve kampanya başarısızlığında tam iade kuralına onay veriyorum. Rezervasyondan sonra geç doğrulanan ödeme de tam iade edilir.</label>
      </fieldset>
      <p><strong>Sepet toplamı: {validAmount ? money(total) : 'Geçerli bir tutar girin'}</strong></p><p className="print-muted">Kesin toplam sunucuda hesaplanır. Sepet kalan hedefe tam sığmalıdır; kısmi tahsilat yapılmaz.</p>
      <Button type="submit" disabled={action.busy || !validAmount || !total || !accepted || !paymentsEnabled || !user || campaign.state !== 'ACTIVE'}>{attempted ? 'Aynı işlemi güvenle yeniden sorgula' : mode === 'IYZICO_SANDBOX' ? 'iyzico test ödemesine geç' : 'Test ödeme rezervasyonu oluştur'}</Button>
      {attempted && <><p className="ui-notice">İstek gönderildi; sepet kilitlendi. Yanıt kaybolduysa aynı düğmeyle mevcut işlem alınır. Yeniden başlamadan önce <Link to="/funding-history">işlem geçmişinizi</Link> kontrol edin.</p><Button variant="ghost" disabled={action.busy} onClick={() => { sessionStorage.removeItem(storageKey); key.current = null; setAttempted(false); setAccepted(false); }}>Yeni sepet hazırla (önceki işlem ayrıca sürer)</Button></>}
      </form></section>}
    <p><Link to="/funding-history">Ödeme sonucumu ve siparişlerimi sunucudan kontrol et →</Link></p>
  </div></MainLayout>;
}
