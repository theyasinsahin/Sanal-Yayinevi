import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { GET_ADMIN_OVERVIEW } from '../../../graphql/admin';
import { adminDate } from '../../../utils/admin';
import '../Data/AdminData.css';

export default function AdminOverview() {
  const { data, loading, error, refetch } = useQuery(GET_ADMIN_OVERVIEW, { fetchPolicy: 'network-only' });
  const summary = data?.getAdminOverview;
  return <AdminLayout title="Yönetim Paneli">
    {loading && <p role="status">Yönetim özeti yükleniyor...</p>}
    {error && <p className="ui-notice ui-notice--error" role="alert">{error.message} <button className="ui-text-link" onClick={() => refetch()}>Tekrar dene</button></p>}
    {summary && <>
      <div className="admin-overview-cards">{summary.counts.map(item => <Link key={item.resource} className="admin-overview-card" to={`/admin/data/${item.resource}`}><span>{item.label}</span><strong>{item.total}</strong><small>{item.active} aktif / arşiv dışı kayıt</small></Link>)}</div>
      <section className="admin-record-panel"><h2>İnceleme bekleyenler</h2><p><Link className="ui-text-link" to="/admin/printed-books">{summary.pendingBooks} basılı kitap başvurusu · {summary.pendingClaims} yazar hak talebi</Link></p><p><Link className="ui-text-link" to="/admin/session-access">{summary.pendingSessionAccess} oturum oluşturma izni başvurusu</Link></p></section>
      <section className="admin-record-panel"><h2>Başarılı ödemeler</h2>{summary.revenue.length ? summary.revenue.map(item => <p key={item.currency}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency }).format(item.amount)} · {item.count} işlem</p>) : <p>Henüz başarılı ödeme yok.</p>}<Link className="ui-text-link" to="/admin/transactions">Finansal kayıtları incele</Link></section>
      <section className="admin-record-panel"><h2>Son yönetim işlemleri</h2>{summary.recent.length ? <ul>{summary.recent.map(item => <li key={item.id}><Link className="ui-text-link" to={`/admin/data/${item.values.resource}?record=${item.values.recordId}`}>{item.values.resource} · {item.values.action === 'CREATE' ? 'Oluşturuldu' : 'Güncellendi'}</Link> — {item.values.reason} <small>{adminDate(item.values.createdAt)}</small></li>)}</ul> : <p>Henüz kaydedilmiş yönetim işlemi yok.</p>}<Link className="ui-text-link" to="/admin/data/AdminAudit">İşlem geçmişinin tamamı</Link></section>
    </>}
  </AdminLayout>;
}
