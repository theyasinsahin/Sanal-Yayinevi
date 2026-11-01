import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_CLASSIFICATION_OPTIONS, SEARCH_CLASSIFICATION_TAGS } from '../../../graphql/classification';
import './Classification.css';

export default function ClassificationFilters({ value = {}, onChange }) {
  const { data, error } = useQuery(GET_CLASSIFICATION_OPTIONS);
  const [tagSearch, setTagSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => { const timer = setTimeout(() => setDebounced(tagSearch), 250); return () => clearTimeout(timer); }, [tagSearch]);
  const { data: tags } = useQuery(SEARCH_CLASSIFICATION_TAGS, { variables: { search: debounced }, skip: debounced.trim().length < 2 });
  const options = data?.getClassificationOptions;
  const select = (label, key, items) => <label className="classification-select">{label}<select value={value[key]?.[0] || ''} onChange={event => onChange({ ...value, [key]: event.target.value ? [event.target.value] : [] })}><option value="">Tümü</option>{items.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>;
  return <div className="classification-fields" aria-label="Eser filtreleri">
    {error && <p role="alert">Sınıflandırma filtreleri yüklenemedi.</p>}
    {options && <>
      {select('Eser biçimi', 'formats', options.formats)}
      <label className="classification-select">Tür ve konu<select value={value.genres?.[0] || ''} onChange={event => onChange({ ...value, genres: event.target.value ? [event.target.value] : [] })}><option value="">Tümü</option>{[['FICTION', 'Kurgu ve Hikâyeler'], ['KNOWLEDGE', 'Bilgi ve Düşünce']].map(([group, name]) => <optgroup key={group} label={name}>{options.genres.filter(item => item.group === group).map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</optgroup>)}</select></label>
      {select('Anlatım özelliği', 'features', options.narrativeFeatures)}
      {select('Hedef okur kitlesi', 'audiences', options.targetAudiences)}
    </>}
    <label className="classification-select">Etiket ara<input type="search" value={tagSearch} maxLength={50} onChange={event => setTagSearch(event.target.value)} /></label>
    {tags?.searchClassificationTags.length > 0 && select('Etiket seç', 'tags', tags.searchClassificationTags)}
    {value.tags?.length > 0 && <button type="button" className="ui-text-link" onClick={() => onChange({ ...value, tags: [] })}>Etiket filtresini kaldır</button>}
  </div>;
}
