import React, { useId, useState } from 'react';
import './Classification.css';

export default function GenrePreferenceChoices({ genres, selected, onChange, valueKey = 'id', disabled = false }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const term = search.toLocaleLowerCase('tr-TR').trim();
  return <div className="classification-fields">
    <label className="classification-select" htmlFor={id}>Tür ve konu ara<input id={id} type="search" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} /></label>
    {[['FICTION', 'Kurgu ve Hikâyeler'], ['KNOWLEDGE', 'Bilgi ve Düşünce']].map(([group, title]) => <fieldset key={group} className="classification-group"><legend>{title}</legend><div className="classification-options classification-options--scroll">
      {genres.filter(genre => genre.group === group && genre.name.toLocaleLowerCase('tr-TR').includes(term)).map(genre => {
        const key = genre[valueKey];
        return <label key={genre.id}><input type="checkbox" checked={selected.includes(key)} disabled={disabled} onChange={() => onChange(selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key])} />{genre.name}</label>;
      })}
    </div></fieldset>)}
  </div>;
}
