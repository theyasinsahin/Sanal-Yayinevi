import React, { useEffect, useId, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_CLASSIFICATION_OPTIONS, SEARCH_CLASSIFICATION_TAGS } from '../../../graphql/classification';
import { Button } from '../../UI/Button';
import './Classification.css';

export const emptyClassification = () => ({ formatId: '', genreIds: [], tags: [], narrativeFeatureIds: [], targetAudienceId: '', contentWarningIds: [] });
export const classificationFromBook = book => ({
  formatId: book.format?.id || '', genreIds: (book.genres || []).map(item => item.id),
  tags: (book.classificationTags || []).map(item => item.name),
  narrativeFeatureIds: (book.narrativeFeatures || []).map(item => item.id),
  targetAudienceId: book.targetAudience?.id || '', contentWarningIds: (book.contentWarnings || []).map(item => item.id),
});
export const classificationInput = value => ({ ...value, targetAudienceId: value.targetAudienceId || null });
export const classificationError = value => !value.formatId ? 'Bir eser biçimi seçin.' : value.genreIds.length < 1 || value.genreIds.length > 3 ? 'En az 1, en fazla 3 tür/konu seçin.' : value.tags.length > 8 ? 'En fazla 8 etiket ekleyin.' : '';
const normalized = name => name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('tr-TR');

export default function ClassificationFields({ value, onChange, disabled = false, existing = {} }) {
  const id = useId();
  const { data, loading, error, refetch } = useQuery(GET_CLASSIFICATION_OPTIONS);
  const options = data?.getClassificationOptions;
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [tagError, setTagError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTagSearch(tag.trim()), 250); return () => clearTimeout(timer); }, [tag]);
  const { data: tagData } = useQuery(SEARCH_CLASSIFICATION_TAGS, { variables: { search: tagSearch }, skip: tagSearch.length < 2 });
  const set = (key, next) => onChange({ ...value, [key]: next });
  const toggle = (key, selected) => set(key, value[key].includes(selected) ? value[key].filter(item => item !== selected) : [...value[key], selected]);
  function addTag(name = tag) {
    const clean = name.normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (clean.length < 2 || clean.length > 50 || !/^[\p{L}\p{N}\p{M} '#+.-]+$/u.test(clean)) { setTagError('Etiket 2–50 karakter olmalı; harf, rakam ve basit noktalama içermelidir.'); return; }
    if (value.tags.length >= 8) { setTagError('En fazla 8 etiket ekleyebilirsiniz.'); return; }
    if (value.tags.some(item => normalized(item) === normalized(clean))) { setTagError('Bu etiket zaten eklendi.'); return; }
    set('tags', [...value.tags, clean]); setTag(''); setTagError('');
  }
  const lookup = (items, selected, old = []) => items?.find(item => item.id === selected)?.name || old.find(item => item.id === selected)?.name || 'Önceki seçim (yeniden seçin)';
  const withInactive = (items, old = []) => [...items, ...old.filter(item => !items.some(active => active.id === item.id)).map(item => ({ ...item, name: `${item.name} (pasif; kaldırın)` }))];
  const checks = (items, key, label, max) => <fieldset className="classification-group"><legend>{label}{max ? ` (${value[key].length}/${max})` : ' (isteğe bağlı)'}</legend>
    <div className="classification-options">{items.map(item => <label key={item.id}><input type="checkbox" checked={value[key].includes(item.id)} disabled={disabled || (max && value[key].length >= max && !value[key].includes(item.id))} onChange={() => toggle(key, item.id)} />{item.name}</label>)}</div>
  </fieldset>;
  return <div className="classification-fields">
    {loading && <p role="status">Sınıflandırma seçenekleri yükleniyor…</p>}
    {error && <p role="alert">Seçenekler yüklenemedi. <Button type="button" variant="link" onClick={() => refetch()}>Yeniden dene</Button></p>}
    <label className="classification-select" htmlFor={`${id}-format`}>Eser biçimi *
      <select id={`${id}-format`} value={value.formatId} required disabled={disabled || !options} onChange={event => set('formatId', event.target.value)}>
        <option value="">Eser biçimini seçin</option>
        {value.formatId && !options?.formats.some(item => item.id === value.formatId) && <option value={value.formatId}>{existing.format?.name || 'Önceki biçim'} (pasif; yeniden seçin)</option>}
        {options?.formats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <fieldset className="classification-group"><legend>Tür ve konular * ({value.genreIds.length}/3)</legend>
      <label htmlFor={`${id}-genre-search`}>Tür/konu ara</label><input id={`${id}-genre-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} />
      <div className="classification-chips">{value.genreIds.map(selected => <button key={selected} type="button" disabled={disabled} onClick={() => toggle('genreIds', selected)} aria-label={`${lookup(options?.genres, selected, existing.genres)} türünü kaldır`}>{lookup(options?.genres, selected, existing.genres)} ×</button>)}</div>
      {options && [['FICTION', 'Kurgu ve Hikâyeler'], ['KNOWLEDGE', 'Bilgi ve Düşünce']].map(([group, title]) => <div key={group}><h4>{title}</h4><div className="classification-options classification-options--scroll">
        {options.genres.filter(item => item.group === group && normalized(item.name).includes(normalized(search))).map(item => <label key={item.id}><input type="checkbox" checked={value.genreIds.includes(item.id)} disabled={disabled || (value.genreIds.length >= 3 && !value.genreIds.includes(item.id))} onChange={() => toggle('genreIds', item.id)} />{item.name}</label>)}
      </div></div>)}
    </fieldset>
    <fieldset className="classification-group"><legend>Etiketler ({value.tags.length}/8, isteğe bağlı)</legend>
      <div className="classification-tag-input"><label htmlFor={`${id}-tag`}>Etiket ara veya yeni etiket yaz<input id={`${id}-tag`} value={tag} maxLength={50} disabled={disabled} onChange={event => setTag(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} /></label><Button type="button" variant="outline" disabled={disabled || !tag.trim() || value.tags.length >= 8} onClick={() => addTag()}>Ekle</Button></div>
      {tag && <div className="classification-chips">{tagData?.searchClassificationTags.filter(item => !value.tags.some(name => normalized(name) === normalized(item.name))).map(item => <button key={item.id} type="button" disabled={disabled} onClick={() => addTag(item.name)}>{item.name} +</button>)}</div>}
      <div className="classification-chips">{value.tags.map(name => <button key={name} type="button" disabled={disabled} onClick={() => set('tags', value.tags.filter(item => item !== name))} aria-label={`${name} etiketini kaldır`}>{name} ×</button>)}</div>
      {tagError && <p role="alert">{tagError}</p>}
    </fieldset>
    {options && checks(withInactive(options.narrativeFeatures, existing.narrativeFeatures), 'narrativeFeatureIds', 'Anlatım özellikleri')}
    <label className="classification-select" htmlFor={`${id}-audience`}>Hedef okur kitlesi (isteğe bağlı)<select id={`${id}-audience`} disabled={disabled || !options} value={value.targetAudienceId} onChange={event => set('targetAudienceId', event.target.value)}><option value="">Belirtilmedi</option>{options && withInactive(options.targetAudiences, existing.targetAudience ? [existing.targetAudience] : []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {options && checks(withInactive(options.contentWarnings, existing.contentWarnings), 'contentWarningIds', 'İçerik uyarıları')}
    <p className="classification-hint">İçerik uyarısı belirtilmemesi, eserin her yaşa uygun olduğu anlamına gelmez. Anlatım özellikleri basım uygunluğu veya telif izni yerine geçmez.</p>
  </div>;
}
