import GenrePreferenceChoices from '../../Books/Classification/GenrePreferenceChoices';
import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '../../UI/Button';
import { Input } from '../../UI/Input';
import { Textarea } from '../../UI/Textarea';
import { GET_ALL_GENRES } from '../../../graphql/queries/genre';
import { UPDATE_AUTHOR_SETTINGS_MUTATION } from '../../../graphql/mutations/user';

export default function AuthorSettings({ profile, onUpdate, showToast }) {
  const saved = profile.authorSettings || {};
  const [form, setForm] = useState({ copyrightNote: saved.copyrightNote ?? '',
    weeklyWordGoal: saved.weeklyWordGoal ?? '', preferredGenres: saved.preferredGenres ?? [] });
  const [dirty, setDirty] = useState(false);
  const { data, loading: genresLoading, error: genresError, refetch } = useQuery(GET_ALL_GENRES);
  const [save, { loading }] = useMutation(UPDATE_AUTHOR_SETTINGS_MUTATION, {
    update: cache => {
      cache.evict({ fieldName: 'getUserPreference' });
      cache.evict({ fieldName: 'getRecommendations' });
    },
  });
  const set = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); };
  const handleSave = async () => {
    const goal = form.weeklyWordGoal === '' ? null : Number(form.weeklyWordGoal);
    if (goal !== null && (!Number.isSafeInteger(goal) || goal < 0 || goal > 2147483647)) {
      showToast('Kelime hedefi sıfır veya pozitif bir tam sayı olmalı.', 'error'); return;
    }
    if (form.copyrightNote.length > 300) { showToast('Telif notu en fazla 300 karakter olabilir.', 'error'); return; }
    try {
      const authorSettings = { copyrightNote: form.copyrightNote, weeklyWordGoal: goal };
      if (data) {
        const activeNames = new Set(data.getAllGenres.filter(genre => genre.isActive).map(genre => genre.name));
        authorSettings.preferredGenres = form.preferredGenres.filter(name => activeNames.has(name));
      }
      await save({ variables: { authorSettings } });
      setDirty(false);
      await onUpdate();
      showToast('Yazar ayarları kaydedildi.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
  };
  return <div className="settings-section">
    <div className="settings-section-header"><h2 className="settings-section-title">Yazar Tercihleri</h2>
      <p className="settings-section-desc">Yazma hedefinizi ve okuma önerilerinizi kişiselleştirin.</p></div>
    <div className="settings-group">
      <Textarea name="copyrightNote" label="Telif Notu" maxLength={300} rows={3} value={form.copyrightNote}
        placeholder="Yayıneviyle paylaşmak istediğiniz telif ve iletişim tercihleri…"
        onChange={event => set('copyrightNote', event.target.value)} />
      <p className="settings-field-hint">Yalnızca siz ve yayınevi yöneticisi görebilir. {form.copyrightNote.length}/300</p>
    </div>
    <div className="settings-group">
      <Input name="weeklyWordGoal" label="Haftalık Kelime Hedefi" type="number" min={0} step={1}
        placeholder="Örn. 5000" value={form.weeklyWordGoal} onChange={event => set('weeklyWordGoal', event.target.value)} />
      <p className="settings-field-hint">Boş bırakmak veya sıfır girmek hedef takibini kapatır. Hafta pazartesi başlar.</p>
      {saved.weeklyWordGoal > 0 && <p role="status">Bu hafta {profile.weeklyWritingWords ?? 0} / {saved.weeklyWordGoal} kelime yazdınız.
        <progress value={Math.min(profile.weeklyWritingWords ?? 0, saved.weeklyWordGoal)} max={saved.weeklyWordGoal} aria-label="Haftalık yazma hedefi" />
      </p>}
      <p className="settings-field-hint">Kaydettiğiniz bölümlere eklenen yeni kelimeler sayılır.</p>
    </div>
    <fieldset className="settings-group"><legend className="settings-group-label">Tercih Ettiğiniz Türler</legend>
      <p className="settings-row-sublabel">Keşfet sayfasındaki önerilerinizi etkiler.</p>
      {genresLoading && <p role="status">Türler yükleniyor…</p>}
      {genresError && <p role="alert">Türler yüklenemedi. <button onClick={() => refetch()}>Tekrar dene</button></p>}
      <GenrePreferenceChoices genres={(data?.getAllGenres || []).filter(genre => genre.isActive)} selected={form.preferredGenres} onChange={values => set('preferredGenres', values)} valueKey="name" disabled={loading} />
    </fieldset>
    {dirty && <div className="settings-actions"><Button onClick={handleSave} isLoading={loading}>Kaydet</Button></div>}
  </div>;
}
