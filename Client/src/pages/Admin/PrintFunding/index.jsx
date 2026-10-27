import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { Button } from '../../../components/UI/Button';
import * as api from '../../../graphql/printFunding';
import { CampaignCard, Feedback, FileUpload, Pager, Status, money, toMinor, usePrintAction } from '../../../components/PrintFunding/shared';
import ApplicationDetails from '../../../components/PrintFunding/ApplicationDetails';

const costFields = [['printingMinor', 'Matbaa üretimi'], ['shippingMinor', 'Kargo'], ['packagingMinor', 'Paketleme'], ['taxMinor', 'Vergi'], ['providerFeeMinor', 'Ödeme giderleri'], ['serviceMinor', 'Yayın hizmetleri'], ['otherMinor', 'Diğer zorunlu giderler']];
const saleFields = [['unitProductionMinor', 'Birim üretim'], ['unitShippingMinor', 'Birim kargo'], ['unitPackagingMinor', 'Birim paketleme'], ['unitTaxMinor', 'Birim vergi'], ['unitFeeMinor', 'Birim ödeme gideri'], ['unitServiceMinor', 'Birim hizmet'], ['unitMarginMinor', 'Satış payı']];
function AmountFields({ title, fields, values, setValues }) {
  return <fieldset><legend>{title} (TL)</legend><div className="print-grid">{fields.map(([key, label]) => <label key={key}>{label}<input inputMode="decimal" required value={values[key] || ''} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}</div></fieldset>;
}
const amounts = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toMinor(value)]));
function ApplicationReview({ application: app, refresh }) {
  const action = usePrintAction(refresh), [reason, setReason] = useState(''), [decision, setDecision] = useState('REVISION_REQUESTED');
  const [source, setSource] = useState(''), [pages, setPages] = useState(''), [layoutAssetId, setLayout] = useState(''), [quoteAssetId, setQuote] = useState(''), [preflightConfirmed, setPreflight] = useState(false);
  const [components, setComponents] = useState(Object.fromEntries(costFields.map(([key]) => [key, '0']))), [sale, setSale] = useState(Object.fromEntries(saleFields.map(([key]) => [key, '0'])));
  const [days, setDays] = useState(30), [inspected, setInspected] = useState(false);
  async function review(event) {
    event.preventDefault();
    try { await action.run(api.REVIEW_PRINT_APPLICATION, { input: { applicationId: app.id, revision: app.revision, decision, reason, ...(decision === 'APPROVED' ? { quote: { source, confirmedPages: Number(pages), layoutAssetId, quoteAssetId, preflightConfirmed, components: amounts(components), sale: amounts(sale) } } : {}) } }); }
    catch (error) { action.setError(error.message); }
  }
  let target = 0, price = 0; try { target = Object.values(amounts(components)).reduce((a, b) => a + b, 0); price = Object.values(amounts(sale)).reduce((a, b) => a + b, 0); } catch { /* Field validation happens before submitting. */ }
  return <article className="print-panel"><div className="print-heading"><h2>{app.version.title}</h2><Status value={app.state} /></div><p>Başvuru: <code>{app.id}</code> · Yazar: {app.version.authorName}</p>
    <ApplicationDetails application={app} />
    <Feedback error={action.error} message={action.message} />
    {app.state === 'SUBMITTED' && <form onSubmit={review} className="print-form"><fieldset disabled={action.busy}><legend>Yönetici kararı</legend>
      <label>Karar<select value={decision} onChange={e => setDecision(e.target.value)}><option value="REVISION_REQUESTED">Revizyon iste</option><option value="REJECTED">Reddet</option><option value="APPROVED">Onayla</option></select></label>
      <label>İnceleme gerekçesi<textarea required minLength="5" maxLength="2000" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {decision === 'APPROVED' && <>
        <p className="print-sandbox">Bu onay yalnızca sandbox kampanyası açar. Gerçek matbaa fiyatı varmış gibi işlem yapmayın.</p>
        <label>Matbaa / yayınevi teklif referansı<input required minLength="5" maxLength="300" value={source} onChange={e => setSource(e.target.value)} /></label>
        <label>Mizanpajdan doğrulanmış kesin sayfa<input type="number" min="1" max="20000" required value={pages} onChange={e => setPages(e.target.value)} /></label>
        <FileUpload label="Onaylanacak son mizanpaj PDF" value={layoutAssetId} onChange={setLayout} disabled={action.busy} />
        <FileUpload label="Matbaa teklif PDF" value={quoteAssetId} onChange={setQuote} disabled={action.busy} />
        <AmountFields title="Doğrulanmış toplam baskı maliyetleri" fields={costFields} values={components} setValues={setComponents} />
        <AmountFields title="Onaylanacak kitap satış fiyatının bileşenleri" fields={saleFields} values={sale} setValues={setSale} />
        <p>Tahmini maliyet: {money(app.estimate.totalMinor)} · Doğrulanmış hedef: <strong>{money(target)}</strong> · Kitap satış fiyatı: <strong>{money(price)}</strong></p>
        <label className="print-check"><input type="checkbox" required checked={preflightConfirmed} onChange={e => setPreflight(e.target.checked)} />Son metni, mizanpaj sayfalarını, boyut/taşma payı/kapak çözünürlüğünü ve hak/izin beyanlarını inceledim. Teknik özellikleri bu dosyalar için doğruluyorum.</label>
      </>}
      <Button type="submit" disabled={action.busy}>Kararı kaydet</Button>
    </fieldset></form>}
    {app.state === 'APPROVED' && <form className="print-form" onSubmit={async e => { e.preventDefault(); await action.run(api.OPEN_FUNDING_CAMPAIGN, { input: { applicationId: app.id, revision: app.revision, days: Number(days) } }); }}>
      <label>Kampanya süresi (gün)<input type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)} /></label>
      <label className="print-check"><input type="checkbox" required checked={inspected} onChange={e => setInspected(e.target.checked)} />Onaylı sürüm, hedef ve satış fiyatıyla test kampanyası açılmasını onaylıyorum. Aynı başvuru yeniden kampanya oluşturmaz.</label>
      <Button type="submit" disabled={action.busy || !inspected}>Onaylı sandbox kampanyasını aç</Button>
    </form>}
  </article>;
}
function ApplicationsTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(api.ADMIN_PRINT_APPLICATIONS, { variables: { page }, fetchPolicy: 'network-only' });
  return <>{loading && <p role="status">Başvurular yükleniyor…</p>}<Feedback error={error} />{data?.adminPrintApplications.map(item => <ApplicationReview key={`${item.id}:${item.revision}`} application={item} refresh={refetch} />)}{data?.adminPrintApplications.length === 0 && <p>Başvuru yok.</p>}<Pager page={page} setPage={setPage} count={data?.adminPrintApplications.length || 0} /></>;
}
const nextProduction = { PREPARATION: 'PRINTER_APPROVED', PRINTER_APPROVED: 'STARTED', STARTED: 'PRINTING', PRINTING: 'PRINTED', PRINTED: 'PACKAGING', PACKAGING: 'SHIPPING', SHIPPING: 'DELIVERED', DELIVERED: 'COMPLETED' };
function CampaignManager({ campaign, refresh }) {
  const action = usePrintAction(refresh), [message, setMessage] = useState(''), [state, setState] = useState(nextProduction[campaign.productionState] || campaign.previousProductionState || 'ISSUE'), [showAudit, setShowAudit] = useState(false);
  const { data: history, error } = useQuery(api.PRINT_CAMPAIGN_AUDIT, { variables: { campaignId: campaign.id }, skip: !showAudit, fetchPolicy: 'network-only' });
  return <article className="print-panel"><CampaignCard campaign={campaign} /><p>Kampanya: <code>{campaign.id}</code> · <Link to={`/book-detail/${campaign.bookId}`}>Kitap sayfası</Link></p>
    <Feedback error={action.error || error} message={action.message} />
    <form className="print-form" onSubmit={e => e.preventDefault()}><label>İşlem / güncelleme gerekçesi<textarea value={message} minLength="5" maxLength="2000" onChange={e => setMessage(e.target.value)} /></label>
    {['ACTIVE', 'CLOSING'].includes(campaign.state) && <Button variant="danger" disabled={action.busy || message.trim().length < 5} onClick={() => action.run(api.CLOSE_FUNDING_CAMPAIGN, { campaignId: campaign.id, reason: message })}>Kampanyayı kapat ve tam iade sürecine al</Button>}
    {campaign.state === 'SUCCEEDED' && !['COMPLETED', 'CANCELLED'].includes(campaign.productionState) && <><label>Sonraki üretim durumu<select value={state} onChange={e => setState(e.target.value)}>{[nextProduction[campaign.productionState] || campaign.previousProductionState, ...(campaign.productionState !== 'ISSUE' ? ['ISSUE'] : []), 'CANCELLED'].filter(Boolean).map(value => <option value={value} key={value}>{({ PRINTER_APPROVED: 'Matbaa onayladı', STARTED: 'Üretimi başlat', PRINTING: 'Baskıda', PRINTED: 'Baskı tamamlandı', PACKAGING: 'Paketleme', SHIPPING: 'Dağıtım', DELIVERED: 'Teslimatlar tamamlandı', COMPLETED: 'Süreci tamamla', ISSUE: 'Sorun / Gecikme', CANCELLED: 'Üretimi iptal et ve iadeleri başlat' })[value] || value}</option>)}</select></label><Button disabled={action.busy || message.trim().length < 5} onClick={() => action.run(api.UPDATE_PRINT_PRODUCTION, { input: { campaignId: campaign.id, revision: campaign.productionRevision, state, message } })}>Üretim durumunu kaydet</Button></>}
    </form><details onToggle={e => setShowAudit(e.currentTarget.open)}><summary>Denetim geçmişi</summary><ol>{history?.printCampaignAudit?.map(item => <li key={item.id}>{new Date(item.createdAt).toLocaleString('tr-TR')} · {item.action} · {item.to} · {item.reason}</li>)}</ol></details>
  </article>;
}
function CampaignsTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(api.ADMIN_FUNDING_CAMPAIGNS, { variables: { page }, fetchPolicy: 'network-only', pollInterval: 15000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  const action = usePrintAction(refetch);
  return <><Button disabled={action.busy} onClick={() => action.run(api.RUN_PRINT_MAINTENANCE, {})}>Uzlaştırma ve iade işlerini şimdi çalıştır</Button><Feedback error={error || action.error} message={action.message} />{loading && <p role="status">Kampanyalar yükleniyor…</p>}{data?.adminFundingCampaigns.map(item => <CampaignManager key={`${item.id}:${item.state}:${item.productionRevision}`} campaign={item} refresh={refetch} />)}<Pager page={page} setPage={setPage} count={data?.adminFundingCampaigns.length || 0} /></>;
}
function OrderManager({ order, refresh }) {
  const action = usePrintAction(refresh), [reason, setReason] = useState(''), [carrier, setCarrier] = useState(order.carrier || ''), [trackingNumber, setTracking] = useState(order.trackingNumber || '');
  const states = ({ CONFIRMED: ['PACKAGING', 'ISSUE'], PACKAGING: ['SHIPPED', 'ISSUE'], SHIPPED: ['DELIVERED', 'ISSUE'], ISSUE: [order.previousState] })[order.state] || [];
  const [state, setState] = useState(states[0] || ''); const address = order.shippingAddress;
  return <section className="print-panel"><h3>Ön sipariş · {order.quantity} kitap / {money(order.totalMinor)}</h3><Status value={order.state} /><p><code>{order.id}</code></p>
    <details><summary>Yetkili teslimat bilgileri</summary>{address && <address className="print-address">{address.fullName}<br />{address.phone}<br />{address.line}<br />{address.district} / {address.city} {address.postalCode}</address>}<p className="print-muted">Bu bilgileri yalnızca sipariş teslimatı için kullanın.</p></details>
    <Feedback error={action.error} message={action.message} />
    {states.length > 0 && <form className="print-form" onSubmit={async e => { e.preventDefault(); await action.run(api.UPDATE_PRINT_ORDER, { input: { orderId: order.id, revision: order.revision, state, carrier, trackingNumber, reason } }); }}><label>Sipariş durumu<select value={state} onChange={e => setState(e.target.value)}>{states.map(value => <option key={value} value={value}>{({ PACKAGING: 'Paketleme', SHIPPED: 'Kargoya verildi', DELIVERED: 'Teslim edildi', ISSUE: 'Sorun / Gecikme', CONFIRMED: 'Onaylı sipariş' })[value]}</option>)}</select></label>
      {state === 'SHIPPED' && <><label>Kargo firması<input required value={carrier} maxLength="100" onChange={e => setCarrier(e.target.value)} /></label><label>Kargo takip numarası<input required value={trackingNumber} maxLength="100" onChange={e => setTracking(e.target.value)} /></label></>}
      <label>Güncelleme açıklaması<textarea required minLength="5" value={reason} maxLength="2000" onChange={e => setReason(e.target.value)} /></label><Button type="submit" disabled={action.busy}>Siparişi güncelle</Button>
    </form>}
  </section>;
}
function PaymentManager({ payment, refresh }) {
  const action = usePrintAction(refresh), [reason, setReason] = useState('');
  return <section className="print-panel"><h3>{money(payment.amountMinor)} · <Status value={payment.state} /></h3><p>Ödeme: <code>{payment.id}</code></p><p>Karşılıksız: {money(payment.donationMinor)} · Ön sipariş: {payment.quantity} adet / {money(payment.orderMinor)}</p>
    {payment.issue && <Feedback error={`Operasyon incelemesi: ${payment.issue}`} />}
    {payment.captured && !['REFUND_PENDING', 'REFUNDED'].includes(payment.state) && <div className="print-form"><label>Tam iade gerekçesi<textarea minLength="5" maxLength="2000" value={reason} onChange={e => setReason(e.target.value)} /></label><Button variant="danger" disabled={action.busy || reason.trim().length < 5} onClick={() => action.run(api.REQUEST_PRINT_REFUND, { paymentId: payment.id, reason })}>Tam iade iste</Button></div>}<Feedback error={action.error} message={action.message} />
  </section>;
}
function OperationsTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(api.ADMIN_FUNDING_OPERATIONS, { variables: { page }, fetchPolicy: 'network-only' });
  const action = usePrintAction(refetch);
  return <>{loading && <p role="status">Operasyon kayıtları yükleniyor…</p>}<Feedback error={error || action.error} message={action.message} /><h2>İadeler</h2>
    {data?.adminFundingRefunds.map(refund => <section className="print-panel" key={refund.id}><p>{money(refund.amountMinor)} · <Status value={refund.state} /></p><p>{refund.reason} · Deneme: {refund.attempts}</p><p><code>{refund.paymentId}</code></p>{refund.lastError && <p role="alert">{refund.lastError}</p>}{refund.state === 'FAILED' && <Button disabled={action.busy} onClick={() => action.run(api.RETRY_PRINT_REFUND, { refundId: refund.id })}>İadeyi yeniden dene</Button>}</section>)}
    <h2>Ödemeler</h2>{data?.adminFundingPayments.map(payment => <PaymentManager key={`${payment.id}:${payment.state}`} payment={payment} refresh={refetch} />)}
    <h2>Ön sipariş ve teslimat</h2>{data?.adminPrintOrders.map(order => <OrderManager key={`${order.id}:${order.revision}:${order.state}`} order={order} refresh={refetch} />)}
    <Pager page={page} setPage={setPage} count={Math.max(data?.adminFundingPayments.length || 0, data?.adminPrintOrders.length || 0, data?.adminFundingRefunds.length || 0)} />
  </>;
}
function TariffsTab() {
  const { data, loading, error, refetch } = useQuery(api.PRINT_TARIFFS, { fetchPolicy: 'network-only' });
  const action = usePrintAction(refetch), [version, setVersion] = useState(''), [label, setLabel] = useState('ÖRNEK SANDBOX — gerçek matbaa teklifi değildir');
  const [values, setValues] = useState({ enzo: '', ivory: '', coated: '', paperback: '', hardcover: '', setupMinor: '', packagingPerUnitMinor: '', shippingPerUnitMinor: '', serviceMinor: '' });
  const [rate, setRate] = useState({ dimensionSmall: '100', dimensionLarge: '120', colorBps: '200', taxBps: '0', feeBps: '0' });
  const [policy, setPolicy] = useState({ min: '50', max: '100000', quick: '50 100 250 500', days: '30', reservation: '15', quantity: '10' });
  async function submit(event) {
    event.preventDefault();
    try {
      const price = amounts(values), ratios = amounts(rate);
      await action.run(api.CREATE_PRINT_TARIFF, { input: { version, label, pageRates: { enzo: price.enzo, ivory: price.ivory, coated: price.coated }, coverRates: { paperback: price.paperback, hardcover: price.hardcover }, dimensionBps: { '13.5x21': ratios.dimensionSmall, '16x24': ratios.dimensionLarge }, colorBps: ratios.colorBps, taxBps: ratios.taxBps, feeBps: ratios.feeBps, setupMinor: price.setupMinor, packagingPerUnitMinor: price.packagingPerUnitMinor, shippingPerUnitMinor: price.shippingPerUnitMinor, serviceMinor: price.serviceMinor, policy: { donationMinMinor: toMinor(policy.min), donationMaxMinor: toMinor(policy.max), quickAmountsMinor: policy.quick.split(/\s+/).filter(Boolean).map(toMinor), campaignDays: Number(policy.days), reservationMinutes: Number(policy.reservation), maxOrderQuantity: Number(policy.quantity) } } });
    } catch (failure) { action.setError(failure.message); }
  }
  return <>{loading && <p role="status">Tarifeler yükleniyor…</p>}<Feedback error={error || action.error} message={action.message} />
    <section className="print-panel"><h2>Yeni örnek tarife sürümü</h2><p>Tarifeler değiştirilemez. Yeni fiyatlar için yeni sürüm oluşturun; mevcut onaylı hedefler ve satış fiyatları değişmez. Aşağıdaki tutarlar gerçek matbaa fiyatı olarak kullanılmaz.</p>
      <form className="print-form" onSubmit={submit}><fieldset disabled={action.busy}><legend>Tarife</legend><label>Sürüm adı<input required maxLength="80" value={version} onChange={e => setVersion(e.target.value)} /></label><label>Açıklama<input required maxLength="200" value={label} onChange={e => setLabel(e.target.value)} /></label>
        <AmountFields title="Örnek birim ve sabit fiyatlar" fields={[["enzo", 'Enzo sayfa başı'], ['ivory', 'Ivory sayfa başı'], ['coated', 'Kuşe sayfa başı'], ['paperback', 'Karton kapak başı'], ['hardcover', 'Sert kapak başı'], ['setupMinor', 'Sabit hazırlık'], ['packagingPerUnitMinor', 'Kitap başı paketleme'], ['shippingPerUnitMinor', 'Kitap başı kargo'], ['serviceMinor', 'Toplam yayın hizmeti']]} values={values} setValues={setValues} />
        <fieldset><legend>Oranlar (%)</legend><div className="print-grid">{[['dimensionSmall', '13,5 × 21 boyut oranı'], ['dimensionLarge', '16 × 24 boyut oranı'], ['colorBps', 'Renkli sayfa oranı'], ['taxBps', 'Vergi oranı'], ['feeBps', 'Ödeme işlem oranı']].map(([key, title]) => <label key={key}>{title}<input inputMode="decimal" required value={rate[key]} onChange={e => setRate({ ...rate, [key]: e.target.value })} /></label>)}</div></fieldset>
        <fieldset><legend>Destek politikası</legend><div className="print-grid">{[['min', 'Minimum karşılıksız destek (TL)'], ['max', 'Maksimum karşılıksız destek (TL)'], ['quick', 'Hızlı tutarlar (TL, boşlukla ayırın)'], ['days', 'Varsayılan kampanya günü'], ['reservation', 'Rezervasyon süresi (dakika)'], ['quantity', 'Sepette en fazla kitap adedi']].map(([key, title]) => <label key={key}>{title}<input required value={policy[key]} onChange={e => setPolicy({ ...policy, [key]: e.target.value })} /></label>)}</div></fieldset>
        <Button type="submit" disabled={action.busy}>Örnek tarife sürümünü oluştur</Button>
      </fieldset></form>
    </section>{data?.printTariffs.map(tariff => <section className="print-panel" key={tariff.id}><h3>{tariff.version}</h3><p>{tariff.label}</p><details><summary>Fiyat bileşenleri ve politika</summary><pre>{JSON.stringify(tariff.configuration, null, 2)}</pre></details></section>)}
  </>;
}
export default function AdminPrintFundingPage() {
  const [tab, setTab] = useState('applications');
  return <AdminLayout title="Basım, Destek ve Ön Sipariş"><div className="print-page"><p className="print-sandbox">SANDBOX yönetimi. Canlı tahsilat ve gerçek para hareketi kapalıdır.</p><nav className="print-actions" aria-label="Basım yönetimi">{[['applications', 'Başvurular'], ['campaigns', 'Kampanya ve üretim'], ['operations', 'Ödeme, iade ve teslimat'], ['tariffs', 'Fiyat tarifeleri']].map(([value, title]) => <Button key={value} variant={tab === value ? 'primary' : 'outline'} onClick={() => setTab(value)}>{title}</Button>)}</nav>
    {tab === 'applications' && <ApplicationsTab />}{tab === 'campaigns' && <CampaignsTab />}{tab === 'operations' && <OperationsTab />}{tab === 'tariffs' && <TariffsTab />}
  </div></AdminLayout>;
}
