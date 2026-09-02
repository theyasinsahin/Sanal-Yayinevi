// src/components/Notification/NotificationBell/index.jsx
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client';
import { NotificationsOutlined, Notifications } from '@mui/icons-material';
import { GET_NOTIFICATIONS, GET_UNREAD_NOTIFICATION_COUNT } from '../../../graphql/queries/score';
import { MARK_NOTIFICATIONS_READ } from '../../../graphql/mutations/score';
import { useAuth } from '../../../context/AuthContext';
import './NotificationBell.css';

// Panel document.body'ye portallanıp "position: fixed" ile, JS'in
// ölçtüğü gerçek ekran koordinatlarıyla konumlanıyor (bkz. handleOpen).
// Böylece bileşen navbar'da mı yoksa MobileMenu çekmecesinin içinde mi
// render edildiğinden tamamen bağımsız çalışıyor.
const MOBILE_BREAKPOINT = 768; // NavigationBar'ın hamburger'a geçtiği nokta ile aynı

// "label" verildiğinde (mobil menüdeki gibi) ikon + yazı TEK bir
// <button> içinde render edilir; böylece satırın tamamı tıklanabilir
// olur. label verilmezse (navbar'daki gibi) eskisi gibi sadece küçük
// ikon butonu render edilir — davranış değişmez.
const NotificationBell = ({ label, className = '' }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const btnRef = useRef(null);

  const { data: countData, refetch: refetchCount } = useQuery(GET_UNREAD_NOTIFICATION_COUNT, {
    skip: !user,
    pollInterval: 30000, // 30 saniyede bir kontrol
  });

  const { data: notifData, refetch: refetchNotifs } = useQuery(GET_NOTIFICATIONS, {
    skip: !open || !user,
  });

  const [markRead] = useMutation(MARK_NOTIFICATIONS_READ);

  const unreadCount = countData?.getUnreadNotificationCount || 0;
  const notifications = notifData?.getNotifications || [];

  const computeDropdownStyle = () => {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (isMobile) {
      // Mobilde (ve NotificationBell'in nerede render edildiğinden
      // bağımsız olarak) ekranın tamamına yakın, ortalanmış sabit bir
      // panel — tanıdık bir mobil "action sheet" gibi.
      return {
        position: 'fixed',
        top: 'calc(var(--navbar-height, 64px) + 8px)',
        left: '0.75rem',
        right: '0.75rem',
        width: 'auto',
      };
    }

    // Masaüstünde zil ikonunun gerçek ekran konumunu ölçüp panelin
    // hemen altına, sağa hizalı şekilde yerleştiriyoruz.
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) {
      return { position: 'fixed', top: 72, right: 16, width: 320 };
    }
    return {
      position: 'fixed',
      top: rect.bottom + 8,
      right: Math.max(window.innerWidth - rect.right, 8),
      width: 320,
    };
  };

  const handleOpen = async () => {
    const next = !open;
    if (next) {
      setDropdownStyle(computeDropdownStyle());
    }
    setOpen(next);
    if (next && unreadCount > 0) {
      await markRead();
      refetchCount();
      refetchNotifs();
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(Number(dateStr)).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk`;
    if (hours < 24) return `${hours}sa`;
    return `${days}g`;
  };

  if (!user) return null;

  return (
    <div className={`notif-bell-wrapper${className ? ` ${className}` : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className={`notif-bell-btn${label ? ' notif-bell-btn--row' : ''}`}
        onClick={handleOpen}
      >
        <span className="notif-bell-icon">
          {unreadCount > 0
            ? <Notifications fontSize="small" />
            : <NotificationsOutlined fontSize="small" />
          }
          {unreadCount > 0 && (
            <span className="notif-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        {label && <span className="notif-bell-label">{label}</span>}
      </button>

      {open && createPortal(
        <>
          <div className="notif-overlay" onClick={() => setOpen(false)} />
          <div className="notif-dropdown" style={dropdownStyle || undefined}>
            <div className="notif-dropdown-header">
              <span>Bildirimler</span>
            </div>

            {notifications.length === 0 ? (
              <div className="notif-empty">Bildirim yok</div>
            ) : (
              <div className="notif-list">
                {notifications.map(notif => (
                  <div key={notif.id} className={`notif-item ${!notif.isRead ? 'unread' : ''}`}>
                    <span className="notif-icon">{notif.icon}</span>
                    <div className="notif-content">
                      <p className="notif-title">{notif.title}</p>
                      <p className="notif-message">{notif.message}</p>
                      <span className="notif-time">{timeAgo(notif.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;