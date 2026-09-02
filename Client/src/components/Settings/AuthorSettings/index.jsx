// src/components/Settings/AuthorSettings.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Save } from '@mui/icons-material';
import { Button }   from '../../UI/Button';
import { Input }    from '../../UI/Input';
import { Textarea } from '../../UI/Textarea';
import { UPDATE_AUTHOR_SETTINGS_MUTATION } from '../../../graphql/mutations/user';

const LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

const GENRE_OPTIONS = [
  'Roman', 'Hikaye', 'Şiir', 'Deneme', 'Bilim Kurgu',
  'Fantastik', 'Polisiye', 'Korku', 'Çocuk', 'Tarihî',
];

const AuthorSettings = ({ profile, onUpdate, showToast }) => {
  const saved = profile.authorSettings || {};

  const [form, setForm] = useState({
    defaultLanguage:      saved.defaultLanguage      ?? 'tr',
    publishingVisible:    saved.publishingVisible     ?? true,
    copyrightNote:        saved.copyrightNote         ?? '',
    weeklyWordGoal:       saved.weeklyWordGoal        ?? '',
    preferredGenres:      saved.preferredGenres       ?? [],
  });
  const [dirty, setDirty] = useState(false);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setDirty(true); };

  const toggleGenre = (genre) => {
    setForm(p => {
      const has = p.preferredGenres.includes(genre);
      return {
        ...p,
        preferredGenres: has
          ? p.preferredGenres.filter(g => g !== genre)
          : [...p.preferredGenres, genre],
      };
    });
    setDirty(true);
  };

  const [save, { loading }] = useMutation(UPDATE_AUTHOR_SETTINGS_MUTATION, {
    onCompleted: () => { showToast('Yazar ayarları kaydedildi.', 'success'); setDirty(false); onUpdate(); },
    onError: (err) => showToast(err.message, 'error'),
  });

  const handleSave = () => {
    const goal = Number(form.weeklyWordGoal);
    if (form.weeklyWordGoal && (isNaN(goal) || goal < 0)) {
      showToast('Kelime hedefi geçerli bir sayı olmalı.', 'error'); return;
    }
    save({ variables: { authorSettings: { ...form, weeklyWordGoal: goal || null } } });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Yazar Tercihleri</h2>
        <p className="settings-section-desc">
          Yazarlık deneyiminizi ve yayıncılık görünürlüğünüzü kişiselleştirin.
        </p>
      </div>

      {/* ── Yayıncılık ── */}
      <div className="settings-group">
        <span className="settings-group-label">Yayıncılık</span>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">
              Yayınevlerine Görün
              <span className="settings-badge-new">Platform Özelliği</span>
            </span>
            <span className="settings-row-sublabel">
              Aktifken yayınevleri kitaplarınızı keşfedip teklif gönderebilir.
            </span>
          </div>
          <div className="settings-row-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={form.publishingVisible}
                onChange={e => set('publishingVisible', e.target.checked)}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        <div className="settings-field" style={{ marginTop: '1rem' }}>
          <label className="settings-field-label">Telif Notu</label>
          <Textarea
            placeholder="Yayınevleri için telif ve iletişim tercihlerinizi kısaca belirtin…"
            value={form.copyrightNote}
            onChange={e => set('copyrightNote', e.target.value)}
            rows={3}
          />
          <span className="settings-field-hint">
            Bu not yayınevi teklifleriyle birlikte görüntülenecek. (Maks. 300 karakter)
          </span>
        </div>
      </div>

      {/* ── Yazma Tercihleri ── */}
      <div className="settings-group">
        <span className="settings-group-label">Yazma Tercihleri</span>

        <div className="settings-field">
          <label className="settings-field-label">Varsayılan Kitap Dili</label>
          <select
            className="settings-select"
            value={form.defaultLanguage}
            onChange={e => set('defaultLanguage', e.target.value)}
          >
            {LANGUAGE_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Haftalık Kelime Hedefi</label>
          <Input
            placeholder="örn. 5000"
            value={form.weeklyWordGoal}
            onChange={e => set('weeklyWordGoal', e.target.value)}
            type="number"
            min={0}
          />
          <span className="settings-field-hint">
            Boş bırakırsanız hedef takibi devre dışı kalır.
          </span>
        </div>
      </div>

      {/* ── Tercih Edilen Türler ── */}
      <div className="settings-group">
        <span className="settings-group-label">Tercih Ettiğiniz Türler</span>
        <p className="settings-row-sublabel" style={{ marginBottom: '0.875rem' }}>
          Keşif ve öneri algoritmalarını kişiselleştirmek için seçin.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {GENRE_OPTIONS.map(genre => {
            const selected = form.preferredGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                style={{
                  padding: '0.4rem 0.875rem',
                  border: `2px solid ${selected ? 'var(--text-main)' : 'var(--accent-start, #e5e5e5)'}`,
                  borderRadius: '4px',
                  background: selected ? 'var(--text-main)' : 'transparent',
                  color: selected ? 'var(--bg-surface)' : 'var(--text-main)',
                  fontFamily: 'sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {dirty && (
        <div className="settings-actions">
          <Button variant="primary" onClick={handleSave} isLoading={loading} icon={<Save fontSize="small" />}>
            Kaydet
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthorSettings;