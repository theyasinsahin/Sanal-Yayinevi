// src/components/Settings/DangerZone.jsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { WarningAmber, DeleteForever, VisibilityOff } from '@mui/icons-material';
import { Button }   from '../../UI/Button';
import { Input }    from '../../UI/Input';
import {
  DEACTIVATE_ACCOUNT_MUTATION,
  DELETE_ACCOUNT_MUTATION,
} from '../../../graphql/mutations/user';

const DangerZone = ({ profile, showToast }) => {
  const navigate  = useNavigate();
  const { logout } = useAuth();

  // ── Deactivate flow ──
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // ── Delete flow ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput,       setDeleteInput]       = useState('');
  const CONFIRM_PHRASE = 'hesabımı sil';

  const [deactivateAccount] = useMutation(DEACTIVATE_ACCOUNT_MUTATION, {
    onCompleted: () => {
      showToast('Hesabınız devre dışı bırakıldı.', 'info');
      logout();
      navigate('/login');
    },
    onError: (err) => { showToast(err.message, 'error'); setDeactivating(false); },
  });

  const [deleteAccount, { loading: deleting }] = useMutation(DELETE_ACCOUNT_MUTATION, {
    onCompleted: () => {
      showToast('Hesabınız kalıcı olarak silindi.', 'info');
      logout();
      navigate('/');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const handleDeactivate = async () => {
    setDeactivating(true);
    await deactivateAccount();
  };

  const handleDelete = async () => {
    if (deleteInput.trim().toLowerCase() !== CONFIRM_PHRASE) {
      showToast(`Lütfen tam olarak "${CONFIRM_PHRASE}" yazın.`, 'error'); return;
    }
    await deleteAccount();
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title" style={{ color: '#dc2626' }}>Tehlikeli Bölge</h2>
        <p className="settings-section-desc">
          Bu işlemler geri alınamaz. Lütfen dikkatlice okuyun.
        </p>
      </div>

      <div className="settings-danger-zone">
        <span className="settings-group-label" style={{ color: '#dc2626' }}>Hesap İşlemleri</span>

        {/* ── Deactivate ── */}
        <div className="danger-action-row">
          <div className="danger-action-info">
            <span className="danger-action-title">
              <VisibilityOff fontSize="small" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Hesabı Devre Dışı Bırak
            </span>
            <span className="danger-action-desc">
              Profiliniz ve içerikleriniz gizlenir; ancak veriler silinmez.
              Giriş yaparak hesabınızı yeniden aktif edebilirsiniz.
            </span>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateConfirm(v => !v)}
              style={{ borderColor: '#dc2626', color: '#dc2626' }}
            >
              Devre Dışı Bırak
            </Button>
          </div>
        </div>

        {showDeactivateConfirm && (
          <div className="settings-confirm-box">
            <p>
              <strong>Emin misiniz?</strong> Hesabınız gizlenecek ve oturumunuz kapatılacak.
              Giriş yaparak istediğiniz zaman geri dönebilirsiniz.
            </p>
            <div className="settings-confirm-actions">
              <Button
                variant="primary"
                onClick={handleDeactivate}
                isLoading={deactivating}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Evet, Devre Dışı Bırak
              </Button>
              <Button variant="outline" onClick={() => setShowDeactivateConfirm(false)}>
                Vazgeç
              </Button>
            </div>
          </div>
        )}

        {/* ── Delete ── */}
        <div className="danger-action-row" style={{ marginTop: '0.5rem' }}>
          <div className="danger-action-info">
            <span className="danger-action-title">
              <DeleteForever fontSize="small" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Hesabı Kalıcı Olarak Sil
            </span>
            <span className="danger-action-desc">
              Tüm kitaplarınız, alıntılarınız, session'larınız ve profil verileriniz
              geri dönüşü olmayan biçimde silinir. Yayınlanmış kitaplarınız da kaldırılır.
            </span>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(v => !v)}
              style={{ borderColor: '#dc2626', color: '#dc2626' }}
            >
              Hesabı Sil
            </Button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="settings-confirm-box" style={{ borderColor: '#dc2626' }}>
            <p>
              <strong style={{ color: '#dc2626' }}>Bu işlem geri alınamaz.</strong>{' '}
              Devam etmek için aşağıya{' '}
              <strong>"{CONFIRM_PHRASE}"</strong>{' '}
              yazın.
            </p>
            <Input
              placeholder={CONFIRM_PHRASE}
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
            />
            <div className="settings-confirm-actions">
              <Button
                variant="primary"
                onClick={handleDelete}
                isLoading={deleting}
                disabled={deleteInput.trim().toLowerCase() !== CONFIRM_PHRASE}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Kalıcı Olarak Sil
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
              >
                Vazgeç
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Uyarı notu */}
      <div style={{
        display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
        marginTop: '1.5rem', padding: '1rem',
        background: 'rgba(245, 158, 11, 0.07)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '4px',
      }}>
        <WarningAmber style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} fontSize="small" />
        <p style={{ margin: 0, fontFamily: 'sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Hesabınızı silmeden önce yayınevleriyle aktif müzakereleriniz varsa,
          teklifleriniz de iptal olacaktır. Silme işleminden önce tüm anlaşmaları
          tamamladığınızdan emin olun.
        </p>
      </div>
    </div>
  );
};

export default DangerZone;