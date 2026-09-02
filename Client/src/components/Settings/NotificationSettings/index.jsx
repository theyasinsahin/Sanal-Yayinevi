// src/components/Settings/NotificationSettings.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Save, LocalOffer } from '@mui/icons-material';
import { Button } from '../../UI/Button';
import { UPDATE_NOTIFICATION_SETTINGS_MUTATION } from '../../../graphql/mutations/user';

// Gruplar ve satırlar
const NOTIFICATION_GROUPS = [
  {
    id: 'social',
    label: 'Sosyal',
    rows: [
      { key: 'newFollower',     label: 'Yeni Takipçi',          sub: 'Biri sizi takip ettiğinde.' },
      { key: 'mentionInSession',label: 'Session\'da Bahsedilme', sub: 'Bir session\'da etiketlendiğinizde.' },
    ],
  },
  {
    id: 'content',
    label: 'İçerik Etkileşimi',
    rows: [
      { key: 'bookComment',  label: 'Kitaba Yorum',      sub: 'Kitabınıza birisi yorum yaptığında.' },
      { key: 'bookLike',     label: 'Kitaba Beğeni',     sub: 'Kitabınız beğenildiğinde.' },
      { key: 'quoteLike',    label: 'Alıntıya Beğeni',   sub: 'Bir alıntınız beğenildiğinde.' },
      { key: 'sessionReply', label: 'Session Yanıtı',    sub: 'Yazdığınız bir session\'a yanıt geldiğinde.' },
    ],
  },
  {
    id: 'publishing',
    label: 'Yayıncılık',
    rows: [
      {
        key: 'publishingOffer',
        label: 'Yayınevi Teklifi',
        sub: 'Bir yayınevi kitabınıza fiyat teklifi gönderdiğinde.',
        badge: 'ÖNEMLİ',
      },
      { key: 'offerUpdate', label: 'Teklif Güncellemesi', sub: 'Mevcut bir teklifin durumu değiştiğinde.' },
    ],
  },
  {
    id: 'email',
    label: 'E-posta Bildirimleri',
    rows: [
      { key: 'emailDigest',   label: 'Haftalık Özet',       sub: 'Haftalık aktivite özetini e-posta ile alın.' },
      { key: 'emailOffers',   label: 'Teklif E-postaları',  sub: 'Yayınevi teklifleri mutlaka e-posta ile iletilsin.' },
      { key: 'emailMarketing',label: 'Duyurular',           sub: 'Platform haberleri ve güncellemeleri.' },
    ],
  },
];

// Varsayılan her şey açık
const DEFAULT_PREFS = Object.fromEntries(
  NOTIFICATION_GROUPS.flatMap(g => g.rows.map(r => [r.key, true]))
);

const NotificationSettings = ({ profile, onUpdate, showToast }) => {
  const saved = profile.notificationSettings || {};
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...saved });
  const [dirty, setDirty] = useState(false);

  const toggle = (key) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  };

  const [save, { loading }] = useMutation(UPDATE_NOTIFICATION_SETTINGS_MUTATION, {
    onCompleted: () => { showToast('Bildirim tercihleri kaydedildi.', 'success'); setDirty(false); onUpdate(); },
    onError: (err) => showToast(err.message, 'error'),
  });

  const handleSave = () => save({ variables: { notificationSettings: prefs } });

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Bildirimler</h2>
        <p className="settings-section-desc">
          Hangi olaylarda bildirim almak istediğinizi seçin.
        </p>
      </div>

      {NOTIFICATION_GROUPS.map(group => (
        <div key={group.id} className="settings-group">
          <span className="settings-group-label">{group.label}</span>

          {group.rows.map(row => (
            <div key={row.key} className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">
                  {row.label}
                  {row.badge && (
                    <span className="settings-badge-new">{row.badge}</span>
                  )}
                </span>
                <span className="settings-row-sublabel">{row.sub}</span>
              </div>
              <div className="settings-row-control">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={!!prefs[row.key]}
                    onChange={() => toggle(row.key)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
          ))}
        </div>
      ))}

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

export default NotificationSettings;