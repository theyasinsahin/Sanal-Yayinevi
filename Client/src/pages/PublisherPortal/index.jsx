import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { money, statusNames } from '../../components/PrintFunding/shared';
import { PUBLISHER_CATALOG } from '../../graphql/publisher';
import './PublisherPortal.css';

const filters = [
  ['ALL', 'Tüm dijital kitaplar'], ['HAS_CAMPAIGN', 'Kampanya açılmış kitaplar'],
  ['ACTIVE', 'Desteğe açık'], ['SUCCEEDED', 'Hedefe ulaşan'],
];
const date = value => value ? new Date(value).toLocaleString('tr-TR') : '—';

function CampaignSummary({ campaign }) {
  if (!campaign) return <p className="publisher-muted">Güncel destek sisteminde kampanya yok.</p>;
  const progress = campaign.targetMinor ? Math.min(100, campaign.acceptedMinor * 100 / campaign.targetMinor) : 0;
  const expired = campaign.state === 'ACTIVE' && new Date(campaign.endsAt) <= new Date();
  return <div className="publisher-campaign">
    <div className="publisher-campaign-heading">
      <span>{expired ? 'Süre doldu · Kapanış bekleniyor' : statusNames[campaign.state] || campaign.state}</span>
      {campaign.environment === 'SANDBOX' && <span className="publisher-test-label">Test kampanyası</span>}
    </div>
    <progress aria-label="Destek hedefine ulaşma oranı" max="100" value={progress} />
    <p><strong>{money(campaign.acceptedMinor)}</strong> / {money(campaign.targetMinor)} <span>(%{progress.toFixed(1)})</span></p>
    <p className="publisher-muted">{campaign.supporterCount} destekçi · Bitiş: {date(campaign.endsAt)}</p>
  </div>;
}

export default function PublisherPortal() {
  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState({ page: 1, search: '', funding: 'ALL' });
  const { data, loading, error, refetch } = useQuery(PUBLISHER_CATALOG, {
    variables: { ...selection, limit: 20 }, fetchPolicy: 'no-cache',
    pollInterval: 30000, notifyOnNetworkStatusChange: true,
    skipPollAttempt: () => document.visibilityState === 'hidden',
  });
  // Never retain privileged catalog content after an authorization/network error.
  const catalog = error ? null : data?.publisherCatalog;
  const applySearch = event => {
    event.preventDefault();
    setSelection(current => ({ ...current, search: draft.trim(), page: 1 }));
  };
  return <MainLayout><div className="publisher-page">
    <header className="publisher-header">
      <div><p className="publisher-eyebrow">BETİK · YAYINEVLERİ İÇİN</p><h1>Yayınevi Portalı</h1>
        <p>Yeni eserleri keşfedin, kitapların destek yolculuğunu takip edin.</p></div>
      <Button variant="outline" disabled={loading} onClick={() => refetch().catch(() => {})}>Yenile</Button>
    </header>
    <section className="publisher-toolbar" aria-label="Kitap filtreleri">
      <form onSubmit={applySearch} className="publisher-search">
        <label htmlFor="publisher-search">Kitap veya yazar ara</label>
        <div><input id="publisher-search" type="search" maxLength={100} placeholder="Kitap adı, yazar adı veya kullanıcı adı" value={draft} onChange={event => setDraft(event.target.value)} />
          <Button type="submit" variant="primary">Ara</Button></div>
      </form>
      <label className="publisher-filter" htmlFor="publisher-funding">Destek durumu
        <select id="publisher-funding" value={selection.funding} onChange={event => setSelection(current => ({ ...current, page: 1, funding: event.target.value }))}>
          {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </section>
    <div className="publisher-list-heading">
      <h2>{filters.find(([value]) => value === selection.funding)[1]}</h2>
      {catalog && <p>{catalog.total} kitap · Son yenileme: <time dateTime={catalog.refreshedAt}>{date(catalog.refreshedAt)}</time></p>}
    </div>
    <p className="publisher-muted">Destek tutarları 30 saniyede bir güncellenir. Test kampanyaları gerçek tahsilat içermez. Her kitabın en son kampanyası gösterilir.</p>
    {loading && <p role="status">Kitaplar ve destek tutarları güncelleniyor…</p>}
    {error && <div className="publisher-error" role="alert"><p>Portal verileri alınamadı. Erişiminiz değiştiyse yeniden giriş yapın; bağlantınızı kontrol ederek tekrar deneyebilirsiniz.</p><Button variant="outline" onClick={() => refetch().catch(() => {})}>Tekrar dene</Button></div>}
    {catalog?.items.length === 0 && <div className="publisher-empty"><h3>Bu filtrelere uygun kitap bulunamadı.</h3><p>Aramanızı veya destek durumunu değiştirerek yeniden deneyin.</p>
      <Button variant="outline" onClick={() => { setDraft(''); setSelection({ page: 1, search: '', funding: 'ALL' }); }}>Filtreleri temizle</Button></div>}
    <div className="publisher-books" aria-busy={loading}>
      {catalog?.items.map(book => <article key={book.id} className="publisher-book">
        <div className="publisher-cover">{book.imageUrl ? <img src={book.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">B</span>}</div>
        <div className="publisher-book-info"><p className="publisher-eyebrow">{book.writingStatus === 'COMPLETED' ? 'Yazımı tamamlandı' : 'Yazımı sürüyor'}</p>
          <h3><Link to={book.urlSlug ? `/kitap/${encodeURIComponent(book.urlSlug)}` : `/book-detail/${book.id}`}>{book.title}</Link></h3>
          <p className="publisher-author">{book.authorName}</p>
          <p className="publisher-muted">Dijital yayın: {date(book.publishDate)}</p>
          <CampaignSummary campaign={book.campaign} />
        </div>
      </article>)}
    </div>
    {catalog && <nav className="publisher-pagination" aria-label="Kitap sayfaları">
      <Button variant="outline" disabled={loading || selection.page <= 1} onClick={() => setSelection(current => ({ ...current, page: current.page - 1 }))}>Önceki</Button>
      <span>Sayfa {catalog.page} / {Math.max(1, catalog.totalPages)}</span>
      <Button variant="outline" disabled={loading || selection.page >= catalog.totalPages} onClick={() => setSelection(current => ({ ...current, page: current.page + 1 }))}>Sonraki</Button>
    </nav>}
  </div></MainLayout>;
}
