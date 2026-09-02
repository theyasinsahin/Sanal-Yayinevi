// src/components/Settings/UserSettings.jsx
import React, { useState } from 'react';
import {
  ManageAccounts,
  Lock,
  Notifications,
  AutoStories,
  Palette,
  DeleteForever,
} from '@mui/icons-material';

import AccountSettings      from '../AccountSettings';
import PrivacySettings      from '../PrivacySettings';
import NotificationSettings from '../NotificationSettings';
import AuthorSettings       from '../AuthorSettings';
import AppearanceSettings   from '../AppearanceSettings';
import DangerZone           from '../DangerZone';

import './UserSettings.css';

const SECTIONS = [
  { id: 'account',       label: 'Hesap',        icon: <ManageAccounts fontSize="small" /> },
  { id: 'privacy',       label: 'Gizlilik',     icon: <Lock fontSize="small" /> },
  { id: 'notifications', label: 'Bildirimler',  icon: <Notifications fontSize="small" /> },
  { id: 'author',        label: 'Yazar',        icon: <AutoStories fontSize="small" /> },
  { id: 'appearance',    label: 'Görünüm',      icon: <Palette fontSize="small" /> },
  { id: 'danger',        label: 'Hesabı Sil',   icon: <DeleteForever fontSize="small" />, danger: true },
];

const UserSettings = ({ profile, onUpdate, showToast }) => {
  const [activeSection, setActiveSection] = useState('account');

  const sharedProps = { profile, onUpdate, showToast };

  return (
    <div className="settings-wrapper">

      {/* ── Sidebar ── */}
      <aside className="settings-sidebar">
        <span className="settings-sidebar-title">Ayarlar</span>

        {SECTIONS.map((s, i) => (
          <React.Fragment key={s.id}>
            {/* Danger zone'dan önce ayraç */}
            {s.id === 'danger' && <div className="settings-nav-divider" />}
            <button
              className={`settings-nav-btn${s.danger ? ' danger' : ''}${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.icon}
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </aside>

      {/* ── Content ── */}
      <div className="settings-content">
        {activeSection === 'account'       && <AccountSettings      {...sharedProps} />}
        {activeSection === 'privacy'       && <PrivacySettings      {...sharedProps} />}
        {activeSection === 'notifications' && <NotificationSettings {...sharedProps} />}
        {activeSection === 'author'        && <AuthorSettings       {...sharedProps} />}
        {activeSection === 'appearance'    && <AppearanceSettings   {...sharedProps} />}
        {activeSection === 'danger'        && <DangerZone           {...sharedProps} />}
      </div>

    </div>
  );
};

export default UserSettings;