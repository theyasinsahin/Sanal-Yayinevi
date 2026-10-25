import React, { useState } from 'react';
import { Button } from '../../UI/Button';
import { READING_SIZES, useReadingPreferences } from '../../../context/ReadingPreferencesContext';

export default function AppearanceSettings({ showToast }) {
  const { fontSize, saveFontSize } = useReadingPreferences();
  const [selected, setSelected] = useState(fontSize);
  const [error, setError] = useState('');
  const save = () => {
    try {
      saveFontSize(selected);
      setError('');
      showToast('Okuma yazı boyutu kaydedildi.', 'success');
    } catch {
      setError('Bu cihazda tercih kaydedilemedi. Tarayıcı depolama iznini kontrol edin.');
    }
  };
  return <div className="settings-section">
    <div className="settings-section-header">
      <h2 className="settings-section-title">Görünüm</h2>
      <p className="settings-section-desc">Okuma yazı boyutunu bu cihaz için ayarlayın.</p>
    </div>
    <fieldset className="settings-group">
      <legend className="settings-group-label">Okuma Yazı Boyutu</legend>
      <div className="settings-radio-group horizontal">
        {Object.entries({ sm: 'Küçük', md: 'Orta', lg: 'Büyük' }).map(([value, label]) =>
          <label key={value} className={`settings-radio-option${selected === value ? ' selected' : ''}`}>
            <input type="radio" name="fontSize" value={value} checked={selected === value}
              onChange={() => setSelected(value)} />
            <span>{label}</span>
          </label>)}
      </div>
      <p style={{ fontSize: READING_SIZES[selected] }} aria-label="Yazı boyutu önizlemesi">
        Her hikâye bir okurla büyür.
      </p>
      <p className="settings-field-hint">Kitap okuma ekranında ve profil açıklamalarında uygulanır.</p>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {selected !== fontSize && <div className="settings-actions"><Button onClick={save}>Kaydet</Button></div>}
  </div>;
}
