import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { AdminTable } from '../../../components/Admin/AdminTable';
import { Button } from '../../../components/UI/Button';
import { Badge } from '../../../components/UI/Badge';
import { GET_ADMIN_RESOURCES, GET_ADMIN_RECORDS } from '../../../graphql/admin';
import { adminDate, enumLabel, fieldValue, preview } from '../../../utils/admin';
import RecordEditor from './RecordEditor';
import './AdminData.css';

const columnsFor = {
  User: ['username', 'email', 'role', 'isActive'], Book: ['title', 'kind', 'status', 'isDeleted'],
  Genre: ['name', 'slug', 'isActive'], Transaction: ['amount', 'currency', 'status', 'createdAt'],
  AdminAudit: ['resource', 'action', 'reason', 'createdAt'],
};

export default function AdminData({ resource: fixedResource, schema: schemaOnly = false }) {
  const params = useParams();
  const [query, setQuery] = useSearchParams();
  const [search, setSearch] = useState(query.get('search') || '');
  const [notice, setNotice] = useState('');
  const name = fixedResource || params.resource || query.get('resource') || 'User';
  const { data: metadata, loading: metadataLoading, error: metadataError, refetch: retryMetadata } = useQuery(GET_ADMIN_RESOURCES);
  const resources = metadata?.getAdminResources || [];
  const resource = resources.find(item => item.name === name);
  const page = Math.max(1, Number(query.get('page')) || 1);
  const state = query.get('state') || 'ALL';
  const selected = query.get('record');
  const mode = schemaOnly ? 'schema' : query.get('view') || 'records';
  const variables = { resource: name, page, limit: 25, search: query.get('search') || '', state };
  const { data, loading, error, refetch } = useQuery(GET_ADMIN_RECORDS, { variables, skip: !resource || mode === 'schema', fetchPolicy: 'network-only' });
  const list = data?.getAdminRecords;
  useEffect(() => { setSearch(query.get('search') || ''); }, [query]);
  function update(patch) {
    setNotice('');
    const next = new URLSearchParams(query);
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    setQuery(next);
  }
  const fields = resource && (columnsFor[name] || resource.fields.filter(field => !field.sensitive && !field.name.startsWith('_') && !field.reference && !field.name.includes('.') && ['String', 'Boolean', 'Number', 'Date'].includes(field.type)).slice(0, 4).map(field => field.name));
  return <AdminLayout title={schemaOnly ? 'Veri Yapısı ve Şemalar' : resource?.label || 'Veri Yönetimi'}>
    {metadataLoading && <p role="status">Yönetim araçları yükleniyor...</p>}
    {metadataError && <p className="ui-notice ui-notice--error" role="alert">{metadataError.message} <button className="ui-text-link" onClick={() => retryMetadata()}>Tekrar dene</button></p>}
    {!metadataLoading && !metadataError && !resource && <p role="alert">Veri grubu bulunamadı.</p>}
    {resource && <>
      <div className="admin-toolbar"><label>Veri grubu <select aria-label="Veri grubu" value={name} onChange={event => update({ resource: event.target.value, record: null, page: null, search: null })} disabled={Boolean(fixedResource || params.resource)}>{resources.map(item => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label>
        {(fixedResource || params.resource) && <Link className="ui-text-link" to="/admin/data">Bütün veri grupları</Link>}
        {!schemaOnly && <div className="admin-view-tabs"><button className={mode === 'records' ? 'active' : ''} onClick={() => update({ view: null, record: null })}>Kayıtlar</button><button className={mode === 'schema' ? 'active' : ''} onClick={() => update({ view: 'schema', record: null })}>Şema ve alanlar</button></div>}
      </div>
      <p className="admin-description">{resource.description}</p>
      {notice && <p className="ui-notice" role="status">{notice}</p>}
      {mode === 'schema' ? <>
        <AdminTable columns={['Alan', 'Tür', 'Zorunlu', 'Düzenleme', 'İlişki / Seçenekler']} data={resource.fields} renderRow={field => <tr key={field.name}><td><strong>{field.label}</strong><br /><code>{field.name}</code></td><td>{field.type}</td><td>{field.required ? 'Evet' : 'Hayır'}</td><td>{field.sensitive ? 'Gizli' : field.editable ? 'Düzenlenebilir' : 'İşlem akışı / Salt okunur'}</td><td>{field.reference ? <Link className="ui-text-link" to={`/admin/data/${field.reference}`}>{field.reference}</Link> : field.enumValues.map(enumLabel).join(', ') || '—'}</td></tr>} />
        <details className="admin-record-values"><summary>Tanımlı veritabanı indeksleri</summary><pre>{JSON.stringify(resource.indexes, null, 2)}</pre><p>Bu görünüm model tanımlarını gösterir; canlı veritabanındaki indekslerin oluşturulma durumu değildir.</p></details>
      </> : <>
        <form className="admin-toolbar" onSubmit={event => { event.preventDefault(); update({ search: search.trim(), page: null, record: null }); }}>
          <label className="admin-search">Kayıt ara<input value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Ad, başlık, e-posta veya kayıt kimliği" /></label>
          <label>Durum<select value={state} onChange={event => update({ state: event.target.value, page: null, record: null })}><option value="ALL">Tümü</option>{resource.fields.some(field => ['isDeleted', 'isActive'].includes(field.name)) && <option value="ACTIVE">Aktif / arşiv dışı</option>}{resource.fields.some(field => field.name === 'isDeleted') && <option value="DELETED">Kaldırılmış kayıtlar</option>}{resource.fields.some(field => field.name === 'isActive') && <option value="INACTIVE">Pasif</option>}</select></label>
          <Button type="submit" disabled={loading}>Ara</Button>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={loading}>Yenile</Button>
          {resource.canCreate && <Button type="button" onClick={() => update({ record: 'new' })}>{name === 'Genre' ? 'Yeni tür ekle' : 'Yeni kayıt ekle'}</Button>}
        </form>
        {loading && <p role="status">Kayıtlar yükleniyor...</p>}
        {error && <p className="ui-notice ui-notice--error" role="alert">{error.message}</p>}
        {list && <>
          <p className="admin-result-count">{list.total} kayıt · Sayfa {list.page} / {Math.max(1, list.totalPages)}</p>
          <AdminTable columns={[...fields.map(field => resource.fields.find(item => item.name === field)?.label || field), 'İşlemler']} data={list.items} renderRow={item => <tr key={item.id}>{fields.map(field => <td key={field}>{field === 'status' || field === 'role' || field === 'kind' ? <Badge variant="neutral">{enumLabel(fieldValue(item.values, field))}</Badge> : /At$|Date$/.test(field) ? adminDate(fieldValue(item.values, field)) : preview(fieldValue(item.values, field))}</td>)}<td><Button variant="outline" size="small" onClick={() => update({ record: item.id })}>İncele / Düzenle</Button></td></tr>} />
          <div className="admin-pagination"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => update({ page: page - 1, record: null })}>Önceki sayfa</Button><Button variant="outline" disabled={page >= list.totalPages || loading} onClick={() => update({ page: page + 1, record: null })}>Sonraki sayfa</Button></div>
        </>}
        {selected && <RecordEditor key={`${name}:${selected}`} resource={resource} id={selected} onClose={() => update({ record: null })} onSaved={async creating => { if (creating) { update({ record: null, page: null }); setNotice('Yeni kayıt oluşturuldu.'); } try { await refetch(); } catch { setNotice('Değişiklik kaydedildi; kayıt listesi yenilenemedi. Yenile düğmesini kullanabilirsiniz.'); } }} />}
      </>}
    </>}
  </AdminLayout>;
}
