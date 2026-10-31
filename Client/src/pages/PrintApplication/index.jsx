import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../context/AuthContext';
import { GET_BOOK_CARD } from '../../graphql/queries/book';
import { AUTHOR_PRINT_WORKSPACE, SAVE_PRINT_APPLICATION, SUBMIT_PRINT_APPLICATION, CANCEL_PRINT_APPLICATION } from '../../graphql/printFunding';
import { CampaignCard, Feedback, FileUpload, Status, usePrintAction } from '../../components/PrintFunding/shared';
import PrintLink from '../../components/PrintFunding/PrintLink';
import ApplicationDetails from '../../components/PrintFunding/ApplicationDetails';

function ApplicationEditor({ bookId, application, tariffs, refresh }) {
  const previous = application?.version.specification;
  const [spec, setSpec] = useState(previous || { dimension: '13.5x21', paperType: 'enzo', coverType: 'paperback', color: 'BW', printRun: 100, coverAssetId: '', coverDpi: 300, bleedMm: 3, notes: '' });
  const [tariffId, setTariffId] = useState(application?.tariffId || tariffs[0]?.id || '');
  const [declarations, setDeclarations] = useState({ copyright: false, permissions: false, terms: false });
  const action = usePrintAction(refresh), change = (key, value) => setSpec({ ...spec, [key]: value });
  async function save(event) {
    event.preventDefault();
    const { coverSha256, ...specification } = spec;
    await action.run(SAVE_PRINT_APPLICATION, { input: { bookId, tariffId, revision: application?.revision, specification, declarations } });
  }
  return <form className="print-form" onSubmit={save}><h2>{application ? 'Baskı özelliklerini düzenle' : 'Basım için başvur'}</h2>
    <p>Kaydettiğinizde son kayıtlı bölüm metinleri yeni ve değişmez bir basım sürümüne kopyalanır. Dijital metni değiştirmek bu sürümü değiştirmez.</p>
    <fieldset disabled={action.busy}><legend>Fiziksel baskı</legend><div className="print-grid">
      <label>Kitap boyutu<select value={spec.dimension} onChange={e => change('dimension', e.target.value)}><option value="13.5x21">13,5 × 21 cm</option><option value="16x24">16 × 24 cm</option></select></label>
      <label>Kapak türü<select value={spec.coverType} onChange={e => change('coverType', e.target.value)}><option value="paperback">Karton kapak</option><option value="hardcover">Sert kapak</option></select></label>
      <label>Kağıt<select value={spec.paperType} onChange={e => change('paperType', e.target.value)}><option value="enzo">Enzo</option><option value="ivory">Ivory</option><option value="coated">Kuşe</option></select></label>
      <label>İç baskı<select value={spec.color} onChange={e => change('color', e.target.value)}><option value="BW">Siyah beyaz</option><option value="COLOR">Renkli</option></select></label>
      <label>Tahmini baskı adedi<input type="number" min="1" max="100000" required value={spec.printRun} onChange={e => change('printRun', Number(e.target.value))} /></label>
      <label>Kapak çözünürlüğü (DPI)<input type="number" min="300" max="2400" required value={spec.coverDpi} onChange={e => change('coverDpi', Number(e.target.value))} /></label>
      <label>Taşma payı (mm)<input type="number" min="3" max="20" required value={spec.bleedMm} onChange={e => change('bleedMm', Number(e.target.value))} /></label>
      <label>Örnek maliyet tarifesi<select value={tariffId} required onChange={e => setTariffId(e.target.value)}><option value="">Tarife seçin</option>{tariffs.map(item => <option key={item.id} value={item.id}>{item.version} — {item.label}</option>)}</select></label>
    </div><FileUpload label="Kapak PDF (özel dosya, en fazla 10 MB)" value={spec.coverAssetId} onChange={value => change('coverAssetId', value)} disabled={action.busy} />
    <label>Ek baskı tercihleri<textarea maxLength="2000" value={spec.notes} onChange={e => change('notes', e.target.value)} /></label></fieldset>
    <fieldset disabled={action.busy}><legend>Eser ve izin beyanları · print-sandbox-v1</legend>
      {[['copyright', 'Eserin hak sahibiyim ve basım yetkisine sahibim.'], ['permissions', 'Alıntı, görsel ve üçüncü taraf içeriklerin gerekli izinlerini aldım.'], ['terms', 'Başvurunun yönetici incelemesi gerektirdiğini; bu ortamın yalnızca test olduğunu, yayın/basım sözleşmesi oluşturmadığını kabul ediyorum.']].map(([key, label]) => <label className="print-check" key={key}><input type="checkbox" required checked={declarations[key]} onChange={e => setDeclarations({ ...declarations, [key]: e.target.checked })} />{label}</label>)}
    </fieldset><Feedback error={action.error} message={action.message} /><Button type="submit" disabled={action.busy || !spec.coverAssetId || !tariffId}>Basım sürümünü sabitle ve başvuruyu kaydet</Button>
  </form>;
}
export default function PrintApplicationPage() {
  const { bookId } = useParams(), { user } = useAuth();
  const [newApplication, setNewApplication] = useState(false), [cancelReason, setCancelReason] = useState('');
  const { data: bookData } = useQuery(GET_BOOK_CARD, { variables: { id: bookId } });
  const { data, loading, error, refetch } = useQuery(AUTHOR_PRINT_WORKSPACE, { variables: { bookId }, fetchPolicy: 'network-only' });
  const action = usePrintAction(refetch), app = data?.myPrintApplicationForBook, overview = data?.printOverview;
  const canEdit = !app || ['PREPARING', 'REVISION_REQUESTED'].includes(app.state) || newApplication;
  const hasCampaign = overview?.campaign?.applicationId === app?.id;
  const isAuthor = bookData?.getBookById?.author?.id === user?.id;
  return <MainLayout><div className="print-page"><PrintLink variant="ghost" to={`/dashboard/${bookId}`}>← Yazı masasına dön</PrintLink><h1>Basım başvurusu</h1><p className="print-sandbox">Test ortamı. Kampanya yönetici onayıyla açılır; gerçek ödeme ve basım sözleşmesi kurulmaz.</p>
    {loading && <p role="status">Başvuru yükleniyor…</p>}<Feedback error={error || action.error} message={action.message} />
    {overview && <p>Dijital yayın: {overview.digitalStatus === 'PUBLISHED' ? 'Yayında' : 'Taslak'} · Yazım: {overview.writingStatus === 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'} · Ücretsiz basım ilgisi: {overview.interestCount}</p>}
    {overview?.campaign && <CampaignCard campaign={overview.campaign} />}
    {app && <section className="print-panel"><div className="print-heading"><h2>{app.version.title}</h2><Status value={app.state} /></div><ApplicationDetails key={`${app.id}:${app.revision}`} application={app} />
      {app.state === 'PREPARING' && <Button disabled={action.busy} onClick={() => action.run(SUBMIT_PRINT_APPLICATION, { applicationId: app.id, revision: app.revision })}>Başvuruyu incelemeye gönder</Button>}
      {!hasCampaign && ['PREPARING', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED'].includes(app.state) && <details><summary>Başvuruyu iptal et</summary><div className="print-form"><label>İptal gerekçesi<textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></label><Button variant="danger" disabled={action.busy || cancelReason.trim().length < 5} onClick={() => action.run(CANCEL_PRINT_APPLICATION, { applicationId: app.id, revision: app.revision, reason: cancelReason })}>Başvuruyu iptal et</Button></div></details>}
    </section>}
    {data && isAuthor && overview?.digitalStatus === 'PUBLISHED' && overview.writingStatus === 'COMPLETED' && canEdit && <section className="print-panel"><ApplicationEditor key={`${app?.id}:${app?.revision}:${newApplication}`} bookId={bookId} application={newApplication ? null : app} tariffs={data.printTariffs} refresh={async () => { await refetch(); setNewApplication(false); }} /></section>}
    {app && ['REJECTED', 'CANCELLED'].includes(app.state) && !newApplication && <Button onClick={() => setNewApplication(true)}>Yeni başvuru hazırla</Button>}
    {overview && (overview.digitalStatus !== 'PUBLISHED' || overview.writingStatus !== 'COMPLETED') && <p className="ui-notice">Önce yazı masasından kitabı dijital yayımlayın ve yazımı tamamlayın.</p>}
    {data?.printTariffs?.length === 0 && <p className="ui-notice">Yönetici henüz örnek fiyat tarifesi oluşturmadı. Başvuru kaydetmeden önce tarife gerekli.</p>}
  </div></MainLayout>;
}
