// src/hooks/useReadingTracker.js
import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { ADD_READING_MINUTES } from '../graphql/mutations/score';

const IDLE_TIMEOUT = 2 * 60 * 1000;    // 2 dakika aksiyonsuzluk
const SAVE_INTERVAL = 60 * 1000;        // Her 1 dakikada bir kaydet
const IDLE_WARNING_AFTER = 90 * 1000;  // 1.5 dakikada uyarı göster

export const useReadingTracker = ({ isActive, onIdleWarning, onIdleResume }) => {
// useReadingTracker.js içinde
const [addReadingMinutes] = useMutation(ADD_READING_MINUTES, {
  onCompleted: (data) => console.log("Puan eklendi:", data),
  onError: (err) => console.error("Puan eklenemedi:", err),
});
  const isIdleRef = useRef(false);
  const activeSecondsRef = useRef(0);
  const idleTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  const resetIdleTimer = useCallback(() => {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      onIdleResume?.();
    }

    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);

    // 1.5 dakikada uyarı göster
    warningTimerRef.current = setTimeout(() => {
      onIdleWarning?.();
    }, IDLE_WARNING_AFTER);

    // 2 dakikada idle'a geç
    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
    }, IDLE_TIMEOUT);
  }, [onIdleWarning, onIdleResume]);

  // Aktif okuma sayacı
  useEffect(() => {
    if (!isActive) return;

    const tick = setInterval(() => {
      if (!isIdleRef.current) {
        activeSecondsRef.current += 1;
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isActive]);

  // Her dakikada bir kaydet
  useEffect(() => {
    if (!isActive) return;

    saveTimerRef.current = setInterval(async () => {
      const minutes = Math.floor(activeSecondsRef.current / 60);
      if (minutes > 0) {
        await addReadingMinutes({ variables: { minutes } });
        activeSecondsRef.current = activeSecondsRef.current % 60;
      }
    }, SAVE_INTERVAL);

    return () => clearInterval(saveTimerRef.current);
  }, [isActive, addReadingMinutes]);

  // Event listener'lar
  useEffect(() => {
    if (!isActive) return;

    const events = ['scroll', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(saveTimerRef.current);
    };
  }, [isActive, resetIdleTimer]);

  // Sayfa kapanırken kalan süreyi kaydet
  useEffect(() => {
    if (!isActive) return;

    const handleUnload = async () => {
      const minutes = Math.floor(activeSecondsRef.current / 60);
      if (minutes > 0) {
        await addReadingMinutes({ variables: { minutes } });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [isActive, addReadingMinutes]);
};