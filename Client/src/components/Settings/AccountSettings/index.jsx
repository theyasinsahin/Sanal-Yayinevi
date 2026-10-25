// src/components/Settings/AccountSettings.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { validatePassword } from '../../../utils/PasswordValidation';
import { useMutation } from '@apollo/client';
import { Save } from '@mui/icons-material';
import { Input }   from '../../UI/Input';
import { Button }  from '../../UI/Button';
import {
  CHANGE_EMAIL_MUTATION,
  CHANGE_PASSWORD_MUTATION,
} from '../../../graphql/mutations/user';

const AccountSettings = ({ profile, onUpdate, showToast }) => {

  // ── Email form ──
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    currentPassword: '',
  });
  const [emailDirty, setEmailDirty] = useState(false);

  // ── Password form ──
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passDirty, setPassDirty] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // ── Mutations ──
  const [changeEmail, { loading: emailLoading }] = useMutation(CHANGE_EMAIL_MUTATION, {
    onCompleted: (data) => {
      showToast(data.changeEmail.message, 'success');
      setEmailForm({ newEmail: '', currentPassword: '' });
      setEmailDirty(false);
      onUpdate();
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const [changePassword, { loading: passLoading }] = useMutation(CHANGE_PASSWORD_MUTATION, {
    onCompleted: () => {
      showToast('Şifre başarıyla değiştirildi.', 'success');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPassDirty(false);
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  // ── Handlers ──
  const handleEmailSave = async () => {
    if (!emailForm.newEmail || !emailForm.currentPassword) {
      showToast('Tüm alanları doldurun.', 'error'); return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.newEmail.trim())) {
      showToast('Geçerli bir e-posta girin.', 'error'); return;
    }
    await changeEmail({ variables: { ...emailForm, newEmail: emailForm.newEmail.trim().toLowerCase() } }).catch(() => {});
  };

  const handlePasswordSave = async () => {
    if (!passForm.currentPassword || !passForm.newPassword) {
      showToast('Tüm alanları doldurun.', 'error'); return;
    }
    const validation = validatePassword(passForm.newPassword);
    if (!validation.isValid) {
      showToast(validation.results.find(rule => !rule.passed).label, 'error'); return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      showToast('Yeni şifreler eşleşmiyor.', 'error'); return;
    }
    await changePassword({ variables: {
      currentPassword: passForm.currentPassword,
      newPassword:     passForm.newPassword,
    }}).catch(() => {});
  };

  const passwordStrength = (pw) => {
    if (!pw) return null;
    const score = validatePassword(pw).results.filter(rule => rule.passed).length;
    if (score <= 2) return { label: 'Zayıf',    color: '#dc2626' };
    if (score === 3) return { label: 'Orta',     color: '#f59e0b' };
    if (score === 4) return { label: 'İyi',      color: '#3b82f6' };
    return             { label: 'Güçlü',   color: '#16a34a' };
  };
  const strength = passwordStrength(passForm.newPassword);

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Hesap</h2>
        <p className="settings-section-desc">
          E-posta ve şifre bilgilerinizi buradan güncelleyebilirsiniz.
        </p>
        <p className="settings-field-hint">
          Google ile kaydolduysanız ve henüz şifreniz yoksa <Link to="/sifremi-unuttum">şifre sıfırlama bağlantısıyla şifre oluşturabilirsiniz</Link>.
        </p>
      </div>

      {/* ── E-posta ── */}
      <div className="settings-group">
        <span className="settings-group-label">E-posta Adresi</span>

        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.35rem', border: 'none', paddingBottom: '1rem' }}>
          <span className="settings-row-label">Mevcut e-posta</span>
          <span className="settings-row-sublabel" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {profile.email}
          </span>
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Yeni E-posta</label>
          <Input
            placeholder="yeni@eposta.com"
            aria-label="Yeni E-posta" name="emailForm-newEmail" value={emailForm.newEmail}
            onChange={e => { setEmailForm(p => ({ ...p, newEmail: e.target.value })); setEmailDirty(true); }}
            type="email"
          />
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Mevcut Şifre (doğrulama)</label>
          <Input
            placeholder="••••••••"
            aria-label="E-posta için mevcut şifre" name="emailForm-currentPassword" value={emailForm.currentPassword}
            onChange={e => { setEmailForm(p => ({ ...p, currentPassword: e.target.value })); setEmailDirty(true); }}
            type="password"
          />
        </div>

        {emailDirty && (
          <div className="settings-actions" style={{ paddingTop: '1rem', marginTop: 0, borderTop: 'none' }}>
            <Button
              variant="primary"
              onClick={handleEmailSave}
              isLoading={emailLoading}
              icon={<Save fontSize="small" />}
            >
              E-postayı Güncelle
            </Button>
            <span className="settings-save-hint">Yeni adresinize bilgilendirme e-postası gönderilir.</span>
          </div>
        )}
      </div>

      {/* ── Şifre ── */}
      <div className="settings-group">
        <span className="settings-group-label">Şifre</span>

        <div className="settings-field">
          <label className="settings-field-label">Mevcut Şifre</label>
          <Input
            placeholder="••••••••"
            aria-label="Mevcut Şifre" name="passForm-currentPassword" value={passForm.currentPassword}
            onChange={e => { setPassForm(p => ({ ...p, currentPassword: e.target.value })); setPassDirty(true); }}
            type={showPasswords ? 'text' : 'password'}
          />
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Yeni Şifre</label>
          <Input
            placeholder="••••••••"
            aria-label="Yeni Şifre" name="passForm-newPassword" value={passForm.newPassword}
            onChange={e => { setPassForm(p => ({ ...p, newPassword: e.target.value })); setPassDirty(true); }}
            type={showPasswords ? 'text' : 'password'}
          />
          {strength && (
            <span className="settings-field-hint" style={{ color: strength.color, fontWeight: 600 }}>
              Şifre gücü: {strength.label}
            </span>
          )}
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Yeni Şifre (Tekrar)</label>
          <Input
            placeholder="••••••••"
            aria-label="Yeni Şifre (Tekrar)" name="passForm-confirmPassword" value={passForm.confirmPassword}
            onChange={e => { setPassForm(p => ({ ...p, confirmPassword: e.target.value })); setPassDirty(true); }}
            type={showPasswords ? 'text' : 'password'}
          />
          {passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword && (
            <span className="settings-field-hint" style={{ color: '#dc2626' }}>Şifreler eşleşmiyor.</span>
          )}
        </div>

        {/* Şifreleri göster toggle */}
        <label className="settings-toggle" style={{ marginTop: '0.25rem' }}>
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={e => setShowPasswords(e.target.checked)}
          />
          <span className="toggle-track" />
          <span className="toggle-label-text">Şifreleri göster</span>
        </label>

        {passDirty && (
          <div className="settings-actions">
            <Button
              variant="primary"
              onClick={handlePasswordSave}
              isLoading={passLoading}
              icon={<Save fontSize="small" />}
            >
              Şifreyi Güncelle
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
