// src/components/Settings/AppearanceSettings.jsx
import React, { useState, useEffect } from 'react';
import { LightMode, DarkMode, SettingsBrightness, Save } from '@mui/icons-material';
import { Button } from '../../UI/Button';

import { useTheme } from '../../../context/ThemeContext';

const THEMES = [
  { value: 'light',  label: 'Açık',   icon: <LightMode fontSize="small" /> },
  { value: 'dark',   label: 'Koyu',   icon: <DarkMode  fontSize="small" /> },
  { value: 'system', label: 'Sistem', icon: <SettingsBrightness fontSize="small" /> },
];

const FONT_SIZES = [
  { value: 'sm',  label: 'Küçük',   px: '14px' },
  { value: 'md',  label: 'Orta',    px: '16px' },
  { value: 'lg',  label: 'Büyük',   px: '18px' },
];

const LANGUAGES = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];

// localStorage anahtarları
const LS_THEME     = 'app_theme';
const LS_FONT_SIZE = 'app_font_size';
const LS_LANGUAGE  = 'app_language';

const AppearanceSettings = ({ showToast }) => {
const { theme, setTheme } = useTheme();
const [fontSize, setFontSize] = useState(() => localStorage.getItem(LS_FONT_SIZE) || 'md');
  const [language, setLanguage] = useState(() => localStorage.getItem(LS_LANGUAGE)  || 'tr');
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Tema önizlemesi — anlık uygula
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', effective);
  }, [theme]);

  // Font boyutu önizlemesi
  useEffect(() => {
    const sizeMap = { sm: '14px', md: '16px', lg: '18px' };
    document.documentElement.style.setProperty('--base-font-size', sizeMap[fontSize]);
  }, [fontSize]);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(LS_THEME,     theme);
    localStorage.setItem(LS_FONT_SIZE, fontSize);
    localStorage.setItem(LS_LANGUAGE,  language);
    setTimeout(() => {
      setSaving(false);
      setDirty(false);
      showToast('Görünüm ayarları kaydedildi.', 'success');
    }, 400);
  };

  const mark = () => setDirty(true);

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Görünüm</h2>
        <p className="settings-section-desc">
          Tema, yazı boyutu ve dil tercihlerinizi buradan ayarlayın.
        </p>
      </div>

      {/* ── Tema ── */}
      <div className="settings-group">
        <span className="settings-group-label">Tema</span>
        <div className="settings-radio-group horizontal">
          {THEMES.map(t => (
            <label
              key={t.value}
              className={`settings-radio-option${theme === t.value ? ' selected' : ''}`}
              style={{ gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={theme === t.value}
                onChange={() => { setTheme(t.value); mark(); }}
              />
              {t.icon}
              <span className="settings-radio-label">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Yazı Boyutu ── */}
      <div className="settings-group">
        <span className="settings-group-label">Okuma Yazı Boyutu</span>
        <div className="settings-radio-group horizontal">
          {FONT_SIZES.map(f => (
            <label
              key={f.value}
              className={`settings-radio-option${fontSize === f.value ? ' selected' : ''}`}
              style={{ flex: '1 1 auto', justifyContent: 'center' }}
            >
              <input
                type="radio"
                name="fontSize"
                value={f.value}
                checked={fontSize === f.value}
                onChange={() => { setFontSize(f.value); mark(); }}
              />
              <span className="settings-radio-label" style={{ fontSize: f.px }}>{f.label}</span>
            </label>
          ))}
        </div>
        <span className="settings-field-hint" style={{ marginTop: '0.5rem', display: 'block' }}>
          Kitap okuma ekranlarında ve profil içeriklerinde uygulanır.
        </span>
      </div>

      {/* ── Dil ── */}
      <div className="settings-group">
        <span className="settings-group-label">Uygulama Dili</span>
        <div className="settings-field">
          <select
            className="settings-select"
            value={language}
            onChange={e => { setLanguage(e.target.value); mark(); }}
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <span className="settings-field-hint">
            Arayüz dilini değiştirir. İçerik dilleri etkilenmez.
          </span>
        </div>
      </div>

      {dirty && (
        <div className="settings-actions">
          <Button variant="primary" onClick={handleSave} isLoading={saving} icon={<Save fontSize="small" />}>
            Kaydet
          </Button>
          <span className="settings-save-hint">Değişiklikler bu cihaza kaydedilir.</span>
        </div>
      )}
    </div>
  );
};

export default AppearanceSettings;