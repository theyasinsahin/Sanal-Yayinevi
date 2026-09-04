// src/components/InstallPrompt/index.jsx
//
// "Daha iyi bir deneyim için uygulamamızı telefonunuza kurun" banner'ı.
//
// - Android / Chrome (ve diğer Chromium tabanlı mobil tarayıcılar):
//   Tarayıcı "beforeinstallprompt" event'ini fırlatır, biz onu yakalayıp
//   kendi banner'ımızı gösteriyoruz; "Kur" butonuna basılınca native
//   kurulum diyaloğunu (event.prompt()) tetikliyoruz.
//
// - iOS Safari: "beforeinstallprompt" event'i YOK — Apple programatik
//   kurulumu desteklemiyor. Kullanıcının Paylaş ikonuna basıp "Ana Ekrana
//   Ekle"yi kendisinin seçmesi gerekiyor. Bu yüzden iOS'ta banner'ı
//   göstermeye devam ediyoruz ama buton native bir kurulum tetiklemek
//   yerine bu adımları gösteren küçük bir talimat açıyor.
//
// - Uygulama zaten yüklüyse (standalone modda açılmışsa) hiçbir şey
//   göstermiyoruz.

import React, { useEffect, useState } from 'react';
import { GetApp, Close, IosShare, AddBox } from '@mui/icons-material';
import './InstallPrompt.css';

const DISMISS_KEY = 'betik_install_prompt_dismissed_at';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  // iOS Safari'nin standalone (ana ekrandan açılmış) modu
  window.navigator.standalone === true;

const isIOS = () => {
  const ua = window.navigator.userAgent || '';
  const isAppleDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ masaüstü modunda "MacIntel" olarak görünür ama
  // dokunmatik ekranı vardır — gerçek Mac'lerde bu olmaz.
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleDevice || isIPadOS13Plus;
};

const wasRecentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
};

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [platform, setPlatform] = useState(null); // 'android' | 'ios'

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    // --- Android / Chrome yolu ---
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault(); // tarayıcının kendi mini-banner'ını engelle
      setDeferredPrompt(event);
      setPlatform('android');
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // --- iOS Safari yolu ---
    // beforeinstallprompt hiç fırlamayacağı için burada doğrudan
    // banner'ı gösteriyoruz.
    let iosTimer;
    if (isIOS()) {
      // Sayfa yüklenir yüklenmez değil, kullanıcı siteyle bir miktar
      // etkileşime girdikten sonra göstermek daha az rahatsız edici —
      // kısa bir gecikme veriyoruz.
      iosTimer = setTimeout(() => {
        setPlatform('ios');
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIOSSteps(false);
  };

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIOSSteps((v) => !v);
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // outcome: 'accepted' | 'dismissed' — ikisinde de event bir daha
    // kullanılamaz, kur diyaloğu kapandı.
    setDeferredPrompt(null);
    setVisible(false);
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  if (!visible) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Uygulamayı kur">
      <div className="install-prompt-inner">
        <div className="install-prompt-icon">
          <img src={`${process.env.PUBLIC_URL}/icons/icon-192.png`} alt="" width="40" height="40" />
        </div>

        <div className="install-prompt-text">
          <p className="install-prompt-title">Daha iyi bir deneyim için</p>
          <p className="install-prompt-subtitle">
            Betik'i telefonunuza kurun — hızlı erişim, tam ekran deneyim.
          </p>

          {showIOSSteps && (
            <ol className="install-prompt-ios-steps">
              <li>
                <IosShare fontSize="inherit" /> Paylaş simgesine dokunun
              </li>
              <li>
                <AddBox fontSize="inherit" /> "Ana Ekrana Ekle"yi seçin
              </li>
            </ol>
          )}
        </div>

        <div className="install-prompt-actions">
          <button
            type="button"
            className="install-prompt-install-btn"
            onClick={handleInstallClick}
          >
            <GetApp fontSize="small" />
            {platform === 'ios'
              ? (showIOSSteps ? 'Anladım' : 'Nasıl Eklenir?')
              : 'Kur'}
          </button>
          <button
            type="button"
            className="install-prompt-close-btn"
            onClick={handleDismiss}
            aria-label="Kapat"
          >
            <Close fontSize="small" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;