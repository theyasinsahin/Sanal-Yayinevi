// src/components/Settings/PrivacySettings.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Save } from '@mui/icons-material';
import { Button } from '../../UI/Button';
import { UPDATE_PRIVACY_SETTINGS_MUTATION } from '../../../graphql/mutations/user';

const MESSAGE_OPTIONS = [
  { value: 'everyone',   label: 'Herkes',          sub: 'Tüm kullanıcılar size mesaj gönderebilir.' },
  { value: 'followers',  label: 'Sadece Takipçiler', sub: 'Yalnızca takip ettiğiniz kişiler.' },
  { value: 'none',       label: 'Kimse',            sub: 'Mesaj kutunuzu tamamen kapatır.' },
];

const PrivacySettings = ({ profile, onUpdate, showToast }) => {
  const settings = profile.privacySettings || {};

  const [form, setForm] = useState({
    isProfilePublic:      settings.isProfilePublic      ?? true,
    isLibraryPublic:      settings.isLibraryPublic      ?? true,
    isFollowListPublic:   settings.isFollowListPublic   ?? true,
    allowMessages:        settings.allowMessages        ?? 'everyone',
    showInSearchEngines:  settings.showInSearchEngines  ?? true,
  });
  const [dirty, setDirty] = useState(false);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setDirty(true); };

  const [savePrivacy, { loading }] = useMutation(UPDATE_PRIVACY_SETTINGS_MUTATION, {
    onCompleted: () => { showToast('Gizlilik ayarları kaydedildi.', 'success'); setDirty(false); onUpdate(); },
    onError:     (err) => showToast(err.message, 'error'),
  });

  const handleSave = () => savePrivacy({ variables: { privacySettings: form } });

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Gizlilik</h2>
        <p className="settings-section-desc">
          Profilinizin ve içeriklerinizin kimler tarafından görüleceğini kontrol edin.
        </p>
      </div>

      {/* ── Profil Görünürlüğü ── */}
      <div className="settings-group">
        <span className="settings-group-label">Profil</span>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Herkese Açık Profil</span>
            <span className="settings-row-sublabel">
              Kapalıysa profiliniz yalnızca takipçilerinize görünür.
            </span>
          </div>
          <div className="settings-row-control">
            <label className="settings-toggle">
              <input type="checkbox" checked={form.isProfilePublic} onChange={e => set('isProfilePublic', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Arama Motorlarında Görün</span>
            <span className="settings-row-sublabel">
              Google gibi motorlar profilinizi indeksleyebilir.
            </span>
          </div>
          <div className="settings-row-control">
            <label className="settings-toggle">
              <input type="checkbox" checked={form.showInSearchEngines} onChange={e => set('showInSearchEngines', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        </div>
      </div>

      {/* ── İçerik Görünürlüğü ── */}
      <div className="settings-group">
        <span className="settings-group-label">İçerik</span>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Kitaplığı Göster</span>
            <span className="settings-row-sublabel">
              Kaydettiğiniz kitaplar profilinizde listelensin mi?
            </span>
          </div>
          <div className="settings-row-control">
            <label className="settings-toggle">
              <input type="checkbox" checked={form.isLibraryPublic} onChange={e => set('isLibraryPublic', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Takip Listesini Göster</span>
            <span className="settings-row-sublabel">
              Kimleri takip ettiğiniz ve takipçileriniz herkese açık olsun mu?
            </span>
          </div>
          <div className="settings-row-control">
            <label className="settings-toggle">
              <input type="checkbox" checked={form.isFollowListPublic} onChange={e => set('isFollowListPublic', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Mesajlaşma ── */}
      <div className="settings-group">
        <span className="settings-group-label">Mesajlaşma</span>
        <p className="settings-row-sublabel" style={{ marginBottom: '0.875rem' }}>
          Size mesaj gönderebilecek kişileri seçin.
        </p>
        <div className="settings-radio-group">
          {MESSAGE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`settings-radio-option${form.allowMessages === opt.value ? ' selected' : ''}`}
            >
              <input
                type="radio"
                name="allowMessages"
                value={opt.value}
                checked={form.allowMessages === opt.value}
                onChange={() => set('allowMessages', opt.value)}
              />
              <div>
                <span className="settings-radio-label">{opt.label}</span>
                <br />
                <span className="settings-radio-sub">{opt.sub}</span>
              </div>
            </label>
          ))}
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

export default PrivacySettings;