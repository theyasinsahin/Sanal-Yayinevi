import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link, useBeforeUnload, useBlocker } from 'react-router-dom';
import { GET_ADMIN_RECORD, GET_ADMIN_RECORDS, SAVE_ADMIN_RECORD } from '../../../graphql/admin';
import { GET_ALL_GENRES } from '../../../graphql/queries/genre';
import { Button } from '../../../components/UI/Button';
import { adminDate, enumLabel, fieldValue } from '../../../utils/admin';

function ReferencePicker({ field, value, onChange, disabled }) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const { data, loading, error } = useQuery(GET_ADMIN_RECORDS, { variables: { resource: field.reference, page: 1, limit: 25, search: term, state: 'ACTIVE', ...(field.relatedBook ? { relatedField: 'bookId', relatedId: field.relatedBook } : {}) } });
  const choices = data?.getAdminRecords?.items || [];
  const labels = useRef(new Map());
  choices.forEach(item => labels.current.set(item.id, item.title));
  field.references?.forEach(item => labels.current.set(item.id, item.title));
  if (field.type === 'Array') return <div>
    <input aria-label={`${field.label} ara`} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} placeholder="Ad veya başlıkla ara" />
    <select id={`admin-field-${field.name}`} value="" onChange={event => { if (event.target.value) onChange([...(value || []), event.target.value]); }} disabled={disabled || loading}><option value="">Eklenecek kaydı seçin</option>{choices.filter(item => !(value || []).includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
    <ul>{(value || []).map(id => <li key={id}>{labels.current.get(id) || id} <button type="button" className="ui-text-link" disabled={disabled} onClick={() => onChange(value.filter(item => item !== id))} aria-label={`${labels.current.get(id) || id} seçimini kaldır`}>Kaldır</button></li>)}</ul>
    {error && <span role="alert">İlişkili kayıtlar yüklenemedi.</span>}
  </div>;
  return <div><input aria-label={`${field.label} ara`} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} placeholder="Kayıt adı veya kimliğiyle ara" />
    <select id={`admin-field-${field.name}`} value={value || ''} onChange={event => onChange(event.target.value || null)} disabled={disabled || loading}>
      <option value="">Seçin</option>
      {value && !choices.some(item => item.id === value) && <option value={value}>{value} (mevcut kayıt)</option>}
      {choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select>{error && <span role="alert">İlişkili kayıtlar yüklenemedi.</span>}</div>;
}

function TextList({ value, onChange, ...props }) {
  const [text, setText] = useState((value || []).join('\n'));
  const sent = useRef(JSON.stringify(value || []));
  useEffect(() => { const next = JSON.stringify(value || []); if (next !== sent.current) { sent.current = next; setText((value || []).join('\n')); } }, [value]);
  return <textarea {...props} value={text} onChange={event => { setText(event.target.value); const items = event.target.value.split('\n').map(item => item.trim()).filter(Boolean); sent.current = JSON.stringify(items); onChange(items); }} rows={4} placeholder="Her satıra bir değer" />;
}

function FieldInput({ field, value, onChange, disabled }) {
  const props = { id: `admin-field-${field.name}`, disabled, required: field.required, 'aria-label': field.label };
  if (field.reference && ['ObjectId', 'Array'].includes(field.type)) return <ReferencePicker {...{ field, value, onChange, disabled }} />;
  if (field.type === 'Boolean') return <input {...props} required={false} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />;
  if (field.enumValues.length) return <select {...props} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">Seçin</option>{value && !field.enumValues.includes(value) && <option value={value}>{enumLabel(value)} (mevcut)</option>}{field.enumValues.map(option => <option key={option} value={option}>{enumLabel(option)}</option>)}</select>;
  if (field.type === 'Number') return <input {...props} type="number" min="0" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))} />;
  if (field.type === 'Array') return <TextList {...props} value={value} onChange={onChange} />;
  if (['content', 'text', 'description', 'bio', 'message', 'note'].includes(field.name)) return <textarea {...props} value={value ?? ''} onChange={event => onChange(event.target.value)} maxLength={field.maxLength || undefined} rows={field.name === 'content' ? 12 : 4} />;
  return <input {...props} type={field.name === 'email' ? 'email' : field.name === 'hexColor' ? 'color' : 'text'} value={value ?? ''} onChange={event => onChange(event.target.value)} maxLength={field.maxLength || undefined} />;
}

export default function RecordEditor({ resource, id, onClose, onSaved }) {
  const creating = id === 'new';
  const { data, loading, error, refetch } = useQuery(GET_ADMIN_RECORD, { variables: { resource: resource.name, id }, skip: creating, fetchPolicy: 'network-only' });
  const [save, { loading: saving }] = useMutation(SAVE_ADMIN_RECORD);
  const [changes, setChanges] = useState({});
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const formRef = useRef(null);
  const busy = useRef(false);
  const dirty = useRef(false);
  const committed = useRef(false);
  const blocker = useBlocker(() => !committed.current && (dirty.current || busy.current));
  useBeforeUnload(event => { if (!committed.current && (dirty.current || busy.current)) { event.preventDefault(); event.returnValue = ''; } });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (busy.current) blocker.reset();
    else if (window.confirm('Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?')) { dirty.current = false; blocker.proceed(); }
    else blocker.reset();
  }, [blocker]);
  const record = data?.getAdminRecord;
  const fields = resource.fields.filter(field => field.editable && !field.sensitive && !(resource.name === 'Book' && record?.values.kind !== 'PRINTED' && ['isbn', 'pageCount', 'printedAuthor', 'publisher', 'publicationYear', 'purchaseUrl', 'publicationEvidenceUrl'].includes(field.name)))
    .map(field => ({ ...field, references: record?.references?.filter(item => item.field === field.name), relatedBook: field.reference === 'Chapter' ? record?.values.bookId : null }));
  useEffect(() => { const first = formRef.current?.querySelector('input, textarea, select, button'); first?.focus(); }, [loading]);
  const set = (field, value) => { dirty.current = true; committed.current = false; setSavedMessage(''); setChanges(previous => ({ ...previous, [field]: value })); };
  async function submit(event) {
    event.preventDefault(); if (busy.current) return;
    setFailure(''); setSavedMessage('');
    const updates = Object.fromEntries(Object.entries(changes).filter(([field, value]) => creating || JSON.stringify(value) !== JSON.stringify(fieldValue(record?.values, field))));
    if (!Object.keys(updates).length) { setFailure('Kaydetmek için en az bir alanı değiştirin.'); return; }
    busy.current = true;
    committed.current = false;
    try {
      await save({ variables: { resource: resource.name, id: creating ? null : id, revision: record?.revision || null, changes: updates, reason: reason.trim() },
        refetchQueries: resource.name === 'Genre' ? [{ query: GET_ALL_GENRES }] : [] });
      committed.current = true; dirty.current = false;
      setChanges({}); setReason(''); setConflict(false);
      if (!creating) await refetch();
      await onSaved(creating);
      setSavedMessage('Değişiklikler kaydedildi.');
    } catch (problem) {
      setFailure(committed.current ? 'Değişiklik kaydedildi; görünüm yenilenemedi. Güncel kaydı tekrar yükleyebilirsiniz.' : problem.message);
      setConflict(problem.graphQLErrors?.some(item => item.extensions?.code === 'CONFLICT') || false);
    } finally { busy.current = false; }
  }
  function close() {
    if (saving || busy.current) return;
    if (Object.keys(changes).length && !window.confirm('Kaydedilmemiş değişiklikler var. Kapatılsın mı?')) return;
    dirty.current = false;
    onClose();
  }
  return <section className="admin-record-panel" aria-labelledby="record-editor-title" ref={formRef}>
    <header className="admin-record-heading"><div><h2 id="record-editor-title">{creating ? `Yeni kayıt: ${resource.label}` : record?.title || 'Kayıt ayrıntısı'}</h2><p>{resource.description}</p></div><Button variant="outline" size="small" onClick={close} disabled={saving}>Kapat</Button></header>
    {loading && <p role="status">Kayıt yükleniyor...</p>}
    {error && <p className="ui-notice ui-notice--error" role="alert">{error.message} <button className="ui-text-link" onClick={() => refetch()}>Tekrar dene</button></p>}
    {!creating && !loading && !error && !record && <p role="alert">Kayıt bulunamadı.</p>}
    {(creating || record) && <>
      {resource.name === 'Genre' && <p className="ui-notice">İkon gerekmez. URL adını boş bırakırsanız yeni türün adından oluşturulur. Pasif türler yeni seçimlerde görünmez; mevcut kitapların türü korunur.</p>}
      {resource.name === 'User' && <p className="ui-notice">Rol, e-posta veya aktiflik değişikliği mevcut oturumları geçersizleştirir. Kullanıcı adı değişirse profil adresi değişir.</p>}
      {resource.name === 'Book' && <div className="admin-action-row"><Link to={`/dashboard/${id}`} className="ui-text-link">Bölümler ve yayın işlemleri</Link>{record?.values.kind === 'PRINTED' && <Link to="/admin/printed-books" className="ui-text-link">Baskı ve hak incelemeleri</Link>}</div>}
      {fields.length > 0 ? <form onSubmit={submit} className="admin-record-form">
        <div className="admin-field-grid">{fields.map(field => <div key={field.name} className={`admin-form-field ${field.type === 'Boolean' ? 'admin-check-field' : ''}`}>
          <label htmlFor={`admin-field-${field.name}`}>{field.label}{creating && resource.name === 'Genre' && field.name === 'slug' ? ' (otomatik)' : field.required ? ' *' : ''}</label>
          <FieldInput field={creating && resource.name === 'Genre' && field.name === 'slug' ? { ...field, required: false } : field} value={field.name in changes ? changes[field.name] : fieldValue(record?.values, field.name) ?? (field.name === 'hexColor' ? '#6366f1' : field.type === 'Boolean' ? field.name === 'isActive' : '')} onChange={value => set(field.name, value)} disabled={saving || conflict || busy.current} />
          {field.name === 'isDeleted' && <small>Yayından kaldırma fiziksel silme yapmaz. Bağlı içerikler birlikte yönetilir.</small>}
        </div>)}</div>
        <div className="admin-form-field"><label htmlFor="admin-change-reason">İşlem gerekçesi *</label><textarea id="admin-change-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={500} required disabled={saving || conflict} rows={2} /></div>
        {failure && <p className="ui-notice ui-notice--error" role="alert">{failure}</p>}
        {conflict && <Button variant="outline" type="button" onClick={async () => { await refetch(); dirty.current = false; setChanges({}); setConflict(false); setFailure(''); }}>Güncel kaydı yükle</Button>}
        {savedMessage && <p className="ui-notice" role="status">{savedMessage}</p>}
        <Button type="submit" disabled={saving || conflict}>{saving ? 'Kaydediliyor...' : creating ? 'Oluştur' : 'Değişiklikleri kaydet'}</Button>
      </form> : <p className="ui-notice">Bu kayıt uygulamanın işlem akışında güncellenir. Şema alanlarında ilişkiler ve kayıt bilgileri aşağıda görülebilir.</p>}
      {record && <details className="admin-record-values"><summary>Tüm kayıt alanları</summary><dl>{resource.fields.filter(field => !field.sensitive).map(field => <div key={field.name}><dt>{field.label} <code>{field.name}</code></dt><dd>{/At$|Date$/.test(field.name) ? adminDate(fieldValue(record.values, field.name)) : <pre>{JSON.stringify(fieldValue(record.values, field.name) ?? null, null, 2)}</pre>}</dd></div>)}</dl><p>Parola ve doğrulama/oturum anahtarları gösterilmez.</p></details>}
      {!!record?.references?.length && <details open className="admin-record-values"><summary>İlişkili kayıtlar</summary><ul>{record.references.map(reference => <li key={`${reference.field}:${reference.id}`}><code>{reference.field}</code>: {reference.exists ? <Link className="ui-text-link" to={`/admin/data/${reference.resource}?record=${reference.id}`}>{reference.title}</Link> : `${reference.id} — bulunamadı`}</li>)}</ul></details>}
      {!creating && <Link className="ui-text-link" to={`/admin/data/AdminAudit?search=${id}`}>Bu kaydın işlem geçmişini ara</Link>}
    </>}
  </section>;
}
